import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIVERSITY_DB, UniversityDatabaseSnapshot } from './mockDatabase';
import {
  buildStudentDormitoryGraph,
  getAuthorizedRoomDetails,
  getAuthorizedStudentDetails,
} from './graphEngine';
import { AccommodationStatus, EntityType, RelationType } from './types';

test('AT-01 & AT-03: active student receives complete hierarchy and only active roommates', () => {
  const res = buildStudentDormitoryGraph(UNIVERSITY_DB, 'sess-ali-rezaei-active');
  assert.equal(res.httpStatus, 200);
  assert.ok(res.data);
  assert.equal(res.data.status, AccommodationStatus.Active);
  assert.equal(res.data.currentStudentNodeId, 'node-stu-stu-101');

  // 1 dormitory + 1 building + 1 floor + 1 room + 4 active students = 8 nodes
  // Note: stu-105 has an ended assignment in room-205 and MUST NOT be included (AT-04)
  assert.equal(res.data.nodes.length, 8);
  assert.equal(res.data.edges.length, 7);

  const studentNodes = res.data.nodes.filter((n) => n.entityType === EntityType.Student);
  assert.equal(studentNodes.length, 4);
  assert.equal(
    studentNodes.some((n) => n.entityId === 'stu-105'),
    false,
    'Ended roommate assignment must not appear in active graph'
  );

  const currentNodes = studentNodes.filter((n) => n.isCurrentStudent);
  assert.equal(currentNodes.length, 1);
  assert.equal(currentNodes[0].entityId, 'stu-101');

  const relationTypes = new Set(res.data.edges.map((e) => e.relationType));
  assert.equal(relationTypes.has(RelationType.ContainsBuilding), true);
  assert.equal(relationTypes.has(RelationType.ContainsFloor), true);
  assert.equal(relationTypes.has(RelationType.ContainsRoom), true);
  assert.equal(relationTypes.has(RelationType.HasResident), true);
});

test('FR-08 & NFR-02: deterministic layout produces identical coordinates regardless of DB row order', () => {
  const baseline = buildStudentDormitoryGraph(UNIVERSITY_DB, 'sess-ali-rezaei-active');
  assert.ok(baseline.data);

  const shuffledDb: UniversityDatabaseSnapshot = {
    ...UNIVERSITY_DB,
    students: [...UNIVERSITY_DB.students].reverse(),
    assignments: [...UNIVERSITY_DB.assignments].reverse(),
  };

  const reversedRun = buildStudentDormitoryGraph(shuffledDb, 'sess-ali-rezaei-active');
  assert.ok(reversedRun.data);

  assert.deepEqual(reversedRun.data.nodes, baseline.data.nodes);
  assert.deepEqual(reversedRun.data.edges, baseline.data.edges);
});

test('AT-02, AT-04, AT-13: unassigned, pending, ended, and incomplete states return accurate statuses', () => {
  const unassigned = buildStudentDormitoryGraph(UNIVERSITY_DB, 'sess-karimi-unassigned');
  assert.equal(unassigned.httpStatus, 200);
  assert.equal(unassigned.data?.status, AccommodationStatus.NotAssigned);
  assert.equal(unassigned.data?.nodes.length, 0);

  const pending = buildStudentDormitoryGraph(UNIVERSITY_DB, 'sess-hosseini-pending');
  assert.equal(pending.httpStatus, 200);
  assert.equal(pending.data?.status, AccommodationStatus.AssignmentPending);
  assert.equal(pending.data?.nodes.length, 0);

  const ended = buildStudentDormitoryGraph(UNIVERSITY_DB, 'sess-nouri-ended');
  assert.equal(ended.httpStatus, 200);
  assert.equal(ended.data?.status, AccommodationStatus.AssignmentEnded);
  assert.equal(ended.data?.nodes.length, 0);

  const incomplete = buildStudentDormitoryGraph(UNIVERSITY_DB, 'sess-sadeghi-incomplete');
  assert.equal(incomplete.httpStatus, 200);
  assert.equal(incomplete.data?.status, AccommodationStatus.DataIncomplete);
  assert.equal(incomplete.data?.nodes.length, 0);
});

test('FR-14 & Section 13.2: sensitive PII and privacy-restricted fields are stripped from all DTOs', () => {
  const graphRes = buildStudentDormitoryGraph(UNIVERSITY_DB, 'sess-ali-rezaei-active');
  const roomRes = getAuthorizedRoomDetails(UNIVERSITY_DB, 'sess-ali-rezaei-active', 'room-205');
  const roommateRes = getAuthorizedStudentDetails(
    UNIVERSITY_DB,
    'sess-ali-rezaei-active',
    'stu-104'
  );

  const combinedPayload = JSON.stringify({
    graph: graphRes.data,
    room: roomRes.data,
    roommate: roommateRes.data,
  });

  // Verify none of the private fields or sample values ever leak
  assert.equal(combinedPayload.includes('nationalId'), false);
  assert.equal(combinedPayload.includes('phoneNumber'), false);
  assert.equal(combinedPayload.includes('studentCode'), false);
  assert.equal(combinedPayload.includes('homeAddress'), false);
  assert.equal(combinedPayload.includes('emergencyContactPhone'), false);
  assert.equal(combinedPayload.includes('0024518921'), false);
  assert.equal(combinedPayload.includes('09123456789'), false);
  assert.equal(combinedPayload.includes('401102451'), false);

  // stu-104 opted out of major visibility for roommates
  assert.equal(roommateRes.httpStatus, 200);
  assert.equal(roommateRes.data?.major, undefined);
});

test('AT-09 & Section 12.2/12.3: cross-room and non-roommate queries are rejected with 403 Forbidden', () => {
  // Ali (in room-205) attempting to inspect room-312 (Sara's room)
  const crossRoom = getAuthorizedRoomDetails(UNIVERSITY_DB, 'sess-ali-rezaei-active', 'room-312');
  assert.equal(crossRoom.httpStatus, 403);
  assert.equal(crossRoom.data, undefined);

  // Ali attempting to inspect Sara (stu-201)
  const crossStudent = getAuthorizedStudentDetails(
    UNIVERSITY_DB,
    'sess-ali-rezaei-active',
    'stu-201'
  );
  assert.equal(crossStudent.httpStatus, 403);
  assert.equal(crossStudent.data, undefined);

  // Ali attempting to inspect ended former roommate stu-105
  const formerRoommate = getAuthorizedStudentDetails(
    UNIVERSITY_DB,
    'sess-ali-rezaei-active',
    'stu-105'
  );
  assert.equal(formerRoommate.httpStatus, 403);

  // Unauthenticated access returns 401
  const unauth = buildStudentDormitoryGraph(UNIVERSITY_DB, undefined);
  assert.equal(unauth.httpStatus, 401);
});
