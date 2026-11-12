export enum EntityType {
  Dormitory = 'dormitory',
  Building = 'building',
  Floor = 'floor',
  Room = 'room',
  Student = 'student',
}

export enum RelationType {
  ContainsBuilding = 'contains_building',
  ContainsFloor = 'contains_floor',
  ContainsRoom = 'contains_room',
  HasResident = 'has_resident',
}

export enum AccommodationStatus {
  Active = 'active',
  NotAssigned = 'not_assigned',
  AssignmentPending = 'assignment_pending',
  AssignmentEnded = 'assignment_ended',
  DataIncomplete = 'data_incomplete',
}

export enum WorkspaceTab {
  Graph = 'graph',
  Summary = 'summary',
  Security = 'security',
  Contract = 'contract',
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeMetadataDto {
  dormitoryName?: string;
  buildingName?: string;
  buildingCode?: string;
  totalFloors?: number;
  floorNumber?: number;
  visibleRoomsCount?: number;
  roomNumber?: string;
  capacity?: number;
  activeOccupancy?: number;
  major?: string;
  faculty?: string;
  entryYear?: number;
  avatarInitials?: string;
  privacyRestrictedFields?: string[];
  academicSemester?: string;
}

export interface GraphNodeDto {
  id: string;
  entityType: EntityType;
  entityId: string;
  label: string;
  subtitle: string;
  position: NodePosition;
  isCurrentStudent?: boolean;
  metadata: NodeMetadataDto;
}

export interface GraphEdgeDto {
  id: string;
  source: string;
  target: string;
  relationType: RelationType;
  label: string;
}

export interface GraphLayoutInfo {
  type: 'deterministic-hierarchical';
  version: number;
}

export interface AuthenticatedStudentBannerDto {
  studentId: string;
  displayName: string;
  faculty: string;
  major: string;
  entryYear: number;
  academicSemester: string;
}

export interface GraphResponseDto {
  apiVersion: 'v1';
  module: 'dormitory';
  status: AccommodationStatus;
  message: string;
  currentStudent: AuthenticatedStudentBannerDto;
  currentStudentNodeId: string | null;
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  layout: GraphLayoutInfo;
  generatedAt: string;
}

export interface RoomResidentSummaryDto {
  studentId: string;
  nodeId: string;
  displayName: string;
  major?: string;
  entryYear?: number;
  isCurrentStudent: boolean;
  avatarInitials?: string;
}

export interface RoomDetailDto {
  roomId: string;
  roomNumber: string;
  floorLabel: string;
  floorNumber: number;
  buildingName: string;
  dormitoryName: string;
  capacity?: number;
  activeOccupancy: number;
  academicSemester: string;
  residents: RoomResidentSummaryDto[];
}

export interface StudentPublicDetailDto {
  studentId: string;
  displayName: string;
  isCurrentStudent: boolean;
  major?: string;
  faculty?: string;
  entryYear?: number;
  avatarInitials?: string;
  roomLabel: string;
  buildingName: string;
  dormitoryName: string;
  privacyNote: string;
}

export interface SessionAccountOption {
  sessionToken: string;
  studentId: string;
  displayName: string;
  roleLabel: string;
  scenarioTitle: string;
  expectedStatus: AccommodationStatus;
}

/* Internal University Reference Database Records (Contains Private Fields - NEVER expose directly) */
export interface DbDormitoryRecord {
  id: string;
  name: string;
  campusZone: string;
}

export interface DbBuildingRecord {
  id: string;
  dormitoryId: string;
  name: string;
  code: string;
  totalFloors: number;
}

export interface DbFloorRecord {
  id: string;
  buildingId: string;
  floorNumber: number;
  title: string;
}

export interface DbRoomRecord {
  id: string;
  floorId: string;
  roomNumber: string;
  title: string;
  capacity: number;
  showCapacityToStudents: boolean;
}

export interface DbStudentRecord {
  id: string;
  displayName: string;
  major: string;
  faculty: string;
  entryYear: number;
  avatarInitials: string;
  allowMajorVisibility: boolean;
  allowAvatarVisibility: boolean;
  /* Sensitive PII - Must be stripped by Backend DTO mapper */
  studentCode: string;
  nationalId: string;
  phoneNumber: string;
  homeAddress: string;
  emergencyContactPhone: string;
}

export interface DbRoomAssignmentRecord {
  id: string;
  studentId: string;
  roomId: string;
  academicSemester: string;
  startDate: string;
  endDate: string;
  assignmentState: 'confirmed' | 'pending' | 'ended';
}
