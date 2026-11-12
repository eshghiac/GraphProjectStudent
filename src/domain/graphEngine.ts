import { UniversityDatabaseSnapshot } from './mockDatabase';
import {
  AccommodationStatus,
  AuthenticatedStudentBannerDto,
  DbRoomAssignmentRecord,
  DbStudentRecord,
  EntityType,
  GraphEdgeDto,
  GraphNodeDto,
  GraphResponseDto,
  NodePosition,
  RelationType,
  RoomDetailDto,
  StudentPublicDetailDto,
} from './types';

export interface ServiceResult<T> {
  httpStatus: number;
  data?: T;
  errorCode?: string;
  message?: string;
}

const CANVAS_CENTER_X = 560;
const TIER_Y: Record<EntityType, number> = {
  [EntityType.Dormitory]: 50,
  [EntityType.Building]: 220,
  [EntityType.Floor]: 390,
  [EntityType.Room]: 560,
  [EntityType.Student]: 750,
};
const STUDENT_HORIZONTAL_GAP = 272;

export const RELATION_LABELS: Record<RelationType, string> = {
  [RelationType.ContainsBuilding]: 'شامل ساختمان',
  [RelationType.ContainsFloor]: 'شامل طبقه',
  [RelationType.ContainsRoom]: 'شامل اتاق',
  [RelationType.HasResident]: 'دارای ساکن',
};

export const STATUS_MESSAGES: Record<AccommodationStatus, string> = {
  [AccommodationStatus.Active]: 'اطلاعات اسکان فعال شما از سامانه مرجع خوابگاه دریافت شد.',
  [AccommodationStatus.NotAssigned]:
    'در حال حاضر اطلاعاتی از محل اسکان شما در سامانه ثبت نشده است. برای پیگیری، با مسئول خوابگاه تماس بگیرید.',
  [AccommodationStatus.AssignmentPending]:
    'درخواست اسکان شما ثبت شده اما هنوز توسط اداره خوابگاه‌ها قطعی و تأیید نهایی نشده است.',
  [AccommodationStatus.AssignmentEnded]:
    'مهلت تخصیص اتاق پیشین شما به پایان رسیده است و در نیم‌سال جاری تخصیص فعالی ثبت نشده است.',
  [AccommodationStatus.DataIncomplete]:
    'اطلاعات محل اسکان شما کامل نیست. لطفاً موضوع را از طریق مسئول خوابگاه پیگیری کنید.',
};

function isDateWithinRange(targetDate: string, startDate: string, endDate: string): boolean {
  return targetDate >= startDate && targetDate <= endDate;
}

function findActiveAssignmentsForStudent(
  db: UniversityDatabaseSnapshot,
  studentId: string
): DbRoomAssignmentRecord[] {
  return db.assignments.filter(
    (a) =>
      a.studentId === studentId &&
      a.assignmentState === 'confirmed' &&
      isDateWithinRange(db.referenceDate, a.startDate, a.endDate)
  );
}

function findActiveAssignmentsForRoom(
  db: UniversityDatabaseSnapshot,
  roomId: string
): DbRoomAssignmentRecord[] {
  return db.assignments.filter(
    (a) =>
      a.roomId === roomId &&
      a.assignmentState === 'confirmed' &&
      isDateWithinRange(db.referenceDate, a.startDate, a.endDate)
  );
}

/**
 * Deterministic hierarchical layout calculator (FR-08, NFR-02).
 * Sorts nodes strictly by stable keys (entityType tier + entityId) so shuffled DB rows
 * always yield identical (x, y) coordinates.
 */
export function computeDeterministicPositions(
  hierarchyIds: {
    dormitoryNodeId?: string;
    buildingNodeId: string;
    floorNodeId: string;
    roomNodeId: string;
  },
  sortedStudentNodeIds: string[]
): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {};

  if (hierarchyIds.dormitoryNodeId) {
    positions[hierarchyIds.dormitoryNodeId] = {
      x: CANVAS_CENTER_X,
      y: TIER_Y[EntityType.Dormitory],
    };
  }

  positions[hierarchyIds.buildingNodeId] = {
    x: CANVAS_CENTER_X,
    y: TIER_Y[EntityType.Building],
  };

  positions[hierarchyIds.floorNodeId] = {
    x: CANVAS_CENTER_X,
    y: TIER_Y[EntityType.Floor],
  };

  positions[hierarchyIds.roomNodeId] = {
    x: CANVAS_CENTER_X,
    y: TIER_Y[EntityType.Room],
  };

  const count = sortedStudentNodeIds.length;
  const totalSpan = count > 1 ? (count - 1) * STUDENT_HORIZONTAL_GAP : 0;
  // In RTL reading order, place index 0 on the right side and progress leftward deterministically
  const startX = CANVAS_CENTER_X + totalSpan / 2;

  sortedStudentNodeIds.forEach((nodeId, index) => {
    positions[nodeId] = {
      x: Math.round(startX - index * STUDENT_HORIZONTAL_GAP),
      y: TIER_Y[EntityType.Student],
    };
  });

  return positions;
}

function toAuthenticatedBanner(
  student: DbStudentRecord,
  semesterLabel: string
): AuthenticatedStudentBannerDto {
  return {
    studentId: student.id,
    displayName: student.displayName,
    faculty: student.faculty,
    major: student.major,
    entryYear: student.entryYear,
    academicSemester: semesterLabel,
  };
}

export function resolveAuthenticatedStudent(
  db: UniversityDatabaseSnapshot,
  sessionToken: string | undefined
): ServiceResult<DbStudentRecord> {
  if (!sessionToken) {
    return {
      httpStatus: 401,
      errorCode: 'UNAUTHENTICATED',
      message: 'نشست کاربری معتبر یافت نشد. لطفاً ابتدا وارد سامانه شوید.',
    };
  }

  const studentId = db.sessions[sessionToken];
  if (!studentId) {
    return {
      httpStatus: 401,
      errorCode: 'INVALID_SESSION',
      message: 'توکن احراز هویت نامعتبر یا منقضی شده است.',
    };
  }

  const student = db.students.find((s) => s.id === studentId);
  if (!student) {
    return {
      httpStatus: 404,
      errorCode: 'STUDENT_PROFILE_NOT_FOUND',
      message: 'پروفایل دانشجویی مرتبط با این حساب یافت نشد.',
    };
  }

  return { httpStatus: 200, data: student };
}

/**
 * Builds the sanitized Read-Only Dormitory Graph DTO for the authenticated student.
 */
export function buildStudentDormitoryGraph(
  db: UniversityDatabaseSnapshot,
  sessionToken: string | undefined
): ServiceResult<GraphResponseDto> {
  const auth = resolveAuthenticatedStudent(db, sessionToken);
  if (!auth.data) {
    return {
      httpStatus: auth.httpStatus,
      errorCode: auth.errorCode,
      message: auth.message,
    };
  }

  const currentStudent = auth.data;
  const activeAssignments = findActiveAssignmentsForStudent(db, currentStudent.id);

  // Detect overlapping/conflicting active room assignments (Section 6.5 rule 4 & HTTP 409/data_incomplete)
  if (activeAssignments.length > 1) {
    return {
      httpStatus: 200,
      data: {
        apiVersion: 'v1',
        module: 'dormitory',
        status: AccommodationStatus.DataIncomplete,
        message:
          'تداخل در تخصیص‌های فعال اتاق شما شناسایی شد. لطفاً موضوع را از طریق مسئول خوابگاه پیگیری کنید.',
        currentStudent: toAuthenticatedBanner(currentStudent, 'نیم‌سال اول ۱۴۰۵–۱۴۰۶'),
        currentStudentNodeId: null,
        nodes: [],
        edges: [],
        layout: { type: 'deterministic-hierarchical', version: 1 },
        generatedAt: db.referenceDate,
      },
    };
  }

  if (activeAssignments.length === 0) {
    // Check if pending or ended
    const allStudentAssignments = db.assignments.filter((a) => a.studentId === currentStudent.id);
    const hasPending = allStudentAssignments.some((a) => a.assignmentState === 'pending');
    const hasEnded = allStudentAssignments.some(
      (a) => a.assignmentState === 'ended' || a.endDate < db.referenceDate
    );

    const derivedStatus = hasPending
      ? AccommodationStatus.AssignmentPending
      : hasEnded
        ? AccommodationStatus.AssignmentEnded
        : AccommodationStatus.NotAssigned;

    return {
      httpStatus: 200,
      data: {
        apiVersion: 'v1',
        module: 'dormitory',
        status: derivedStatus,
        message: STATUS_MESSAGES[derivedStatus],
        currentStudent: toAuthenticatedBanner(currentStudent, 'نیم‌سال اول ۱۴۰۵–۱۴۰۶'),
        currentStudentNodeId: null,
        nodes: [],
        edges: [],
        layout: { type: 'deterministic-hierarchical', version: 1 },
        generatedAt: db.referenceDate,
      },
    };
  }

  const activeAssignment = activeAssignments[0];
  const room = db.rooms.find((r) => r.id === activeAssignment.roomId);
  const floor = room ? db.floors.find((f) => f.id === room.floorId) : undefined;
  const building = floor ? db.buildings.find((b) => b.id === floor.buildingId) : undefined;
  const dormitory = building
    ? db.dormitories.find((d) => d.id === building.dormitoryId)
    : undefined;

  // Validate reference integrity (Section 6.4 data_incomplete & AT-13)
  if (!room || !floor || !building || !dormitory) {
    return {
      httpStatus: 200,
      data: {
        apiVersion: 'v1',
        module: 'dormitory',
        status: AccommodationStatus.DataIncomplete,
        message: STATUS_MESSAGES[AccommodationStatus.DataIncomplete],
        currentStudent: toAuthenticatedBanner(currentStudent, activeAssignment.academicSemester),
        currentStudentNodeId: null,
        nodes: [],
        edges: [],
        layout: { type: 'deterministic-hierarchical', version: 1 },
        generatedAt: db.referenceDate,
      },
    };
  }

  // Gather active room assignments & resolve valid student records sorted deterministically by student.id
  const roomActiveAssignments = findActiveAssignmentsForRoom(db, room.id);
  const residentStudents: DbStudentRecord[] = [];
  for (const assignment of roomActiveAssignments) {
    const stu = db.students.find((s) => s.id === assignment.studentId);
    if (!stu) {
      return {
        httpStatus: 200,
        data: {
          apiVersion: 'v1',
          module: 'dormitory',
          status: AccommodationStatus.DataIncomplete,
          message: STATUS_MESSAGES[AccommodationStatus.DataIncomplete],
          currentStudent: toAuthenticatedBanner(currentStudent, activeAssignment.academicSemester),
          currentStudentNodeId: null,
          nodes: [],
          edges: [],
          layout: { type: 'deterministic-hierarchical', version: 1 },
          generatedAt: db.referenceDate,
        },
      };
    }
    residentStudents.push(stu);
  }

  // Deterministic sort: sort strictly by student ID (stable database primary key)
  residentStudents.sort((a, b) => a.id.localeCompare(b.id));

  const dormitoryNodeId = `node-dorm-${dormitory.id}`;
  const buildingNodeId = `node-bldg-${building.id}`;
  const floorNodeId = `node-flr-${floor.id}`;
  const roomNodeId = `node-room-${room.id}`;
  const studentNodeIds = residentStudents.map((s) => `node-stu-${s.id}`);

  const positions = computeDeterministicPositions(
    {
      dormitoryNodeId,
      buildingNodeId,
      floorNodeId,
      roomNodeId,
    },
    studentNodeIds
  );

  const visibleFloorRoomsCount = db.rooms.filter((r) => r.floorId === floor.id).length;

  const nodes: GraphNodeDto[] = [
    {
      id: dormitoryNodeId,
      entityType: EntityType.Dormitory,
      entityId: dormitory.id,
      label: dormitory.name,
      subtitle: dormitory.campusZone,
      position: positions[dormitoryNodeId],
      metadata: {
        dormitoryName: dormitory.name,
      },
    },
    {
      id: buildingNodeId,
      entityType: EntityType.Building,
      entityId: building.id,
      label: building.name,
      subtitle: `${ building.totalFloors } طبقه · کد ${ building.code }`,
      position: positions[buildingNodeId],
      metadata: {
        dormitoryName: dormitory.name,
        buildingName: building.name,
        buildingCode: building.code,
        totalFloors: building.totalFloors,
      },
    },
    {
      id: floorNodeId,
      entityType: EntityType.Floor,
      entityId: floor.id,
      label: floor.title,
      subtitle: building.name,
      position: positions[floorNodeId],
      metadata: {
        buildingName: building.name,
        floorNumber: floor.floorNumber,
        visibleRoomsCount: visibleFloorRoomsCount,
      },
    },
    {
      id: roomNodeId,
      entityType: EntityType.Room,
      entityId: room.id,
      label: room.title,
      subtitle: room.showCapacityToStudents
        ? `ساکنان فعال: ${residentStudents.length} از ${room.capacity} نفر`
        : `${residentStudents.length} ساکن فعال`,
      position: positions[roomNodeId],
      metadata: {
        dormitoryName: dormitory.name,
        buildingName: building.name,
        floorNumber: floor.floorNumber,
        roomNumber: room.roomNumber,
        capacity: room.showCapacityToStudents ? room.capacity : undefined,
        activeOccupancy: residentStudents.length,
        academicSemester: activeAssignment.academicSemester,
      },
    },
  ];

  const edges: GraphEdgeDto[] = [
    {
      id: `edge-${dormitory.id}-${building.id}`,
      source: dormitoryNodeId,
      target: buildingNodeId,
      relationType: RelationType.ContainsBuilding,
      label: RELATION_LABELS[RelationType.ContainsBuilding],
    },
    {
      id: `edge-${building.id}-${floor.id}`,
      source: buildingNodeId,
      target: floorNodeId,
      relationType: RelationType.ContainsFloor,
      label: RELATION_LABELS[RelationType.ContainsFloor],
    },
    {
      id: `edge-${floor.id}-${room.id}`,
      source: floorNodeId,
      target: roomNodeId,
      relationType: RelationType.ContainsRoom,
      label: RELATION_LABELS[RelationType.ContainsRoom],
    },
  ];

  let currentStudentNodeId: string | null = null;

  for (const stu of residentStudents) {
    const stuNodeId = `node-stu-${stu.id}`;
    const isMe = stu.id === currentStudent.id;
    if (isMe) {
      currentStudentNodeId = stuNodeId;
    }

    const showMajor = isMe || stu.allowMajorVisibility;
    const showAvatar = isMe || stu.allowAvatarVisibility;
    const restricted: string[] = [];
    if (!showMajor) restricted.push('رشته تحصیلی');
    if (!showAvatar) restricted.push('تصویر نمایه');

    nodes.push({
      id: stuNodeId,
      entityType: EntityType.Student,
      entityId: stu.id,
      label: stu.displayName,
      subtitle: isMe
        ? `${stu.major} · شما`
        : showMajor
          ? `${stu.major} · ورودی ${stu.entryYear}`
          : 'هم‌اتاقی فعال',
      isCurrentStudent: isMe,
      position: positions[stuNodeId],
      metadata: {
        major: showMajor ? stu.major : undefined,
        faculty: showMajor ? stu.faculty : undefined,
        entryYear: showMajor ? stu.entryYear : undefined,
        avatarInitials: showAvatar ? stu.avatarInitials : undefined,
        privacyRestrictedFields: restricted.length > 0 ? restricted : undefined,
        academicSemester: activeAssignment.academicSemester,
      },
    });

    edges.push({
      id: `edge-${room.id}-${stu.id}`,
      source: roomNodeId,
      target: stuNodeId,
      relationType: RelationType.HasResident,
      label: RELATION_LABELS[RelationType.HasResident],
    });
  }

  return {
    httpStatus: 200,
    data: {
      apiVersion: 'v1',
      module: 'dormitory',
      status: AccommodationStatus.Active,
      message: STATUS_MESSAGES[AccommodationStatus.Active],
      currentStudent: toAuthenticatedBanner(currentStudent, activeAssignment.academicSemester),
      currentStudentNodeId,
      nodes,
      edges,
      layout: {
        type: 'deterministic-hierarchical',
        version: 1,
      },
      generatedAt: db.referenceDate,
    },
  };
}

/**
 * Authorized Room Details Endpoint Logic (`GET /api/graph/dormitory/rooms/:roomId`).
 * Enforces SRS Section 12.2 & 13.3: knowing a roomId does NOT grant access unless
 * the authenticated student has an active assignment in that room.
 */
export function getAuthorizedRoomDetails(
  db: UniversityDatabaseSnapshot,
  sessionToken: string | undefined,
  requestedRoomId: string
): ServiceResult<RoomDetailDto> {
  const auth = resolveAuthenticatedStudent(db, sessionToken);
  if (!auth.data) {
    return {
      httpStatus: auth.httpStatus,
      errorCode: auth.errorCode,
      message: auth.message,
    };
  }

  const currentStudent = auth.data;
  const room = db.rooms.find((r) => r.id === requestedRoomId);
  if (!room) {
    return {
      httpStatus: 404,
      errorCode: 'ROOM_NOT_FOUND',
      message: 'اتاق موردنظر در سامانه یافت نشد.',
    };
  }

  const activeAssignments = findActiveAssignmentsForStudent(db, currentStudent.id);
  const myRoomAssignment = activeAssignments.find((a) => a.roomId === requestedRoomId);

  if (!myRoomAssignment) {
    return {
      httpStatus: 403,
      errorCode: 'FORBIDDEN_ROOM_ACCESS',
      message: 'شما مجوز مشاهده این اطلاعات را ندارید.',
    };
  }

  const floor = db.floors.find((f) => f.id === room.floorId);
  const building = floor ? db.buildings.find((b) => b.id === floor.buildingId) : undefined;
  const dormitory = building
    ? db.dormitories.find((d) => d.id === building.dormitoryId)
    : undefined;

  if (!floor || !building || !dormitory) {
    return {
      httpStatus: 422,
      errorCode: 'DATA_INCOMPLETE',
      message: STATUS_MESSAGES[AccommodationStatus.DataIncomplete],
    };
  }

  const roomAssignments = findActiveAssignmentsForRoom(db, room.id);
  const residents = roomAssignments
    .map((a) => db.students.find((s) => s.id === a.studentId))
    .filter((s): s is DbStudentRecord => Boolean(s))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((stu) => {
      const isMe = stu.id === currentStudent.id;
      const showMajor = isMe || stu.allowMajorVisibility;
      const showAvatar = isMe || stu.allowAvatarVisibility;
      return {
        studentId: stu.id,
        nodeId: `node-stu-${stu.id}`,
        displayName: stu.displayName,
        major: showMajor ? stu.major : undefined,
        entryYear: showMajor ? stu.entryYear : undefined,
        avatarInitials: showAvatar ? stu.avatarInitials : undefined,
        isCurrentStudent: isMe,
      };
    });

  return {
    httpStatus: 200,
    data: {
      roomId: room.id,
      roomNumber: room.roomNumber,
      floorLabel: floor.title,
      floorNumber: floor.floorNumber,
      buildingName: building.name,
      dormitoryName: dormitory.name,
      capacity: room.showCapacityToStudents ? room.capacity : undefined,
      activeOccupancy: residents.length,
      academicSemester: myRoomAssignment.academicSemester,
      residents,
    },
  };
}

/**
 * Authorized Student Public Details Endpoint Logic (`GET /api/graph/dormitory/students/:studentId`).
 * Enforces SRS Section 12.3 & 13.2: only allows viewing self or active roommates,
 * and strictly strips private PII fields.
 */
export function getAuthorizedStudentDetails(
  db: UniversityDatabaseSnapshot,
  sessionToken: string | undefined,
  requestedStudentId: string
): ServiceResult<StudentPublicDetailDto> {
  const auth = resolveAuthenticatedStudent(db, sessionToken);
  if (!auth.data) {
    return {
      httpStatus: auth.httpStatus,
      errorCode: auth.errorCode,
      message: auth.message,
    };
  }

  const currentStudent = auth.data;
  const targetStudent = db.students.find((s) => s.id === requestedStudentId);
  if (!targetStudent) {
    return {
      httpStatus: 404,
      errorCode: 'STUDENT_NOT_FOUND',
      message: 'اطلاعات دانشجوی موردنظر یافت نشد.',
    };
  }

  const myActiveAssignments = findActiveAssignmentsForStudent(db, currentStudent.id);
  if (myActiveAssignments.length !== 1) {
    return {
      httpStatus: 403,
      errorCode: 'FORBIDDEN_STUDENT_ACCESS',
      message: 'شما مجوز مشاهده این اطلاعات را ندارید.',
    };
  }

  const myRoomId = myActiveAssignments[0].roomId;
  const roomAssignments = findActiveAssignmentsForRoom(db, myRoomId);
  const isSharedActiveRoommate = roomAssignments.some((a) => a.studentId === requestedStudentId);

  if (!isSharedActiveRoommate) {
    return {
      httpStatus: 403,
      errorCode: 'FORBIDDEN_STUDENT_ACCESS',
      message: 'شما مجوز مشاهده این اطلاعات را ندارید.',
    };
  }

  const room = db.rooms.find((r) => r.id === myRoomId);
  const floor = room ? db.floors.find((f) => f.id === room.floorId) : undefined;
  const building = floor ? db.buildings.find((b) => b.id === floor.buildingId) : undefined;
  const dormitory = building
    ? db.dormitories.find((d) => d.id === building.dormitoryId)
    : undefined;

  if (!room || !floor || !building || !dormitory) {
    return {
      httpStatus: 422,
      errorCode: 'DATA_INCOMPLETE',
      message: STATUS_MESSAGES[AccommodationStatus.DataIncomplete],
    };
  }

  const isMe = targetStudent.id === currentStudent.id;
  const showMajor = isMe || targetStudent.allowMajorVisibility;
  const showAvatar = isMe || targetStudent.allowAvatarVisibility;

  return {
    httpStatus: 200,
    data: {
      studentId: targetStudent.id,
      displayName: targetStudent.displayName,
      isCurrentStudent: isMe,
      major: showMajor ? targetStudent.major : undefined,
      faculty: showMajor ? targetStudent.faculty : undefined,
      entryYear: showMajor ? targetStudent.entryYear : undefined,
      avatarInitials: showAvatar ? targetStudent.avatarInitials : undefined,
      roomLabel: room.title,
      buildingName: building.name,
      dormitoryName: dormitory.name,
      privacyNote: isMe
        ? 'اطلاعات هویتی حساس، کد ملی و شماره تماس طبق سیاست حریم خصوصی در لایه گراف ارسال نمی‌شوند.'
        : showMajor
          ? 'صرفاً اطلاعات عمومی مجاز هم‌اتاقی طبق سیاست حریم خصوصی دانشگاه نمایش داده شده است.'
          : 'این هم‌اتاقی نمایش رشته تحصیلی را در تنظیمات حریم خصوصی محدود کرده است.',
    },
  };
}
