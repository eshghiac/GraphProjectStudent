import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addSkillEdge,
  addSkillNode,
  attachDomainToStudent,
  deleteSkillEdge,
  deleteSkillNode,
  detachDomainFromStudent,
  getStudentSkillGraphDto,
  getSystemDomains,
  MAGNETIC_MIN_DIST_X,
  MAGNETIC_MIN_DIST_Y,
  resetStudentSkillGraph,
  resolveMagneticSpacing,
  saveGraphLayout,
  SKILL_NODE_HEIGHT,
  SKILL_NODE_WIDTH,
  updateSkillNode,
} from './skillGraphEngine';

test('SRS FR-01 & FR-02: student receives personal graph with central student node and active domains', () => {
  const graph = getStudentSkillGraphDto('stu-101');
  assert.equal(graph.apiVersion, 'v2');
  assert.equal(graph.studentId, 'stu-101');

  // Verify central student node
  const studentNode = graph.nodes.find((n) => n.nodeType === 'student');
  assert.ok(studentNode, 'Student node must exist');
  assert.equal(studentNode?.title, 'علی رضایی');
  assert.equal(studentNode?.sourceType, 'system');

  // Verify system domains exist and are linked to student
  const domainNodes = graph.nodes.filter((n) => n.nodeType === 'domain');
  assert.ok(domainNodes.length >= 3, 'Must have active university domains in graph');

  const domainEdges = graph.edges.filter((e) => e.relationType === 'has_domain');
  assert.ok(domainEdges.length >= 3, 'Student must be connected to domains');
});

test('SRS FR-03 & FR-04: official university domains can be retrieved, attached and detached', () => {
  const domains = getSystemDomains();
  assert.ok(domains.length >= 8);
  assert.ok(domains.some((d) => d.id === 'domain-tech'));
  assert.ok(domains.some((d) => d.id === 'domain-sport'));

  // Attach a new domain
  const attached = attachDomainToStudent('stu-101', 'domain-sport', 'activity');
  assert.equal(attached.domainId, 'domain-sport');

  const updatedGraph = getStudentSkillGraphDto('stu-101');
  assert.ok(updatedGraph.nodes.some((n) => n.id === 'node-domain-domain-sport'));

  // Detach domain
  const detachRes = detachDomainFromStudent('stu-101', 'domain-sport');
  assert.equal(detachRes.success, true);

  const finalGraph = getStudentSkillGraphDto('stu-101');
  assert.equal(finalGraph.nodes.some((n) => n.id === 'node-domain-domain-sport'), false);
});

test('SRS FR-05 & FR-07: student creates personal skill and connects to domain', () => {
  const newSkill = addSkillNode('stu-101', {
    title: 'برنامه‌نویسی پایتون و هوش مصنوعی',
    nodeType: 'skill',
    domainId: 'domain-tech',
    proficiencyLevel: 'expert',
    learningStatus: 'proficient',
    notes: 'پروژه‌های پژوهشی دانشگاهی',
  });

  assert.equal(newSkill.nodeType, 'skill');
  assert.equal(newSkill.sourceType, 'personal');
  assert.equal(newSkill.verificationStatus, 'unverified');
  assert.equal(newSkill.proficiencyLevel, 'expert');
  assert.equal(newSkill.numericLevel, 5);
  assert.equal(newSkill.domainId, 'domain-tech');

  const graph = getStudentSkillGraphDto('stu-101');
  const belongsToEdge = graph.edges.find((e) => e.source === newSkill.id && e.relationType === 'belongs_to');
  assert.ok(belongsToEdge, 'Skill must be connected to domain via belongs_to edge');
});

test('SRS FR-06 & FR-19: student can update and delete personal skill, but cannot modify official system nodes', () => {
  const skill = addSkillNode('stu-101', {
    title: 'توسعه فلاتر',
    nodeType: 'skill',
    domainId: 'domain-tech',
    proficiencyLevel: 'intermediate',
  });

  // Update personal skill
  const updated = updateSkillNode('stu-101', skill.id, {
    title: 'توسعه فلاتر پیشرفته',
    proficiencyLevel: 'advanced',
    learningStatus: 'practiced',
  });
  assert.equal(updated.title, 'توسعه فلاتر پیشرفته');
  assert.equal(updated.proficiencyLevel, 'advanced');
  assert.equal(updated.numericLevel, 4);

  // Attempting to modify official university system node must fail (FR-19)
  const graph = getStudentSkillGraphDto('stu-101');
  const domainNode = graph.nodes.find((n) => n.sourceType === 'system');
  assert.ok(domainNode);
  assert.throws(() => {
    updateSkillNode('stu-101', domainNode!.id, { title: 'تغییر غیرمجاز' });
  }, /ویرایش مشخصات گره‌های رسمی دانشگاه مجاز نیست/);

  // Delete personal skill
  const delRes = deleteSkillNode('stu-101', skill.id);
  assert.equal(delRes.success, true);
});

test('SRS FR-08 & FR-20: distinguishes between personal, system, and verified reference records', () => {
  const graph = getStudentSkillGraphDto('stu-101');

  // Reference records (achievements / competitions)
  const kharazmi = graph.nodes.find((n) => n.id === 'node-fest-kharazmi');
  assert.ok(kharazmi);
  assert.equal(kharazmi?.sourceType, 'reference');
  assert.equal(kharazmi?.verificationStatus, 'verified');

  // Self-reported personal skills
  const reactSkill = graph.nodes.find((n) => n.id === 'node-skill-react');
  assert.ok(reactSkill);
  assert.equal(reactSkill?.sourceType, 'personal');
  assert.equal(reactSkill?.verificationStatus, 'unverified');
});

test('SRS FR-11: saves and persists custom node layout coordinates', () => {
  const saveRes = saveGraphLayout('stu-101', [
    { nodeId: 'node-skill-react', x: 250, y: 190 },
    { nodeId: 'node-skill-typescript', x: 790, y: 190 },
  ]);

  assert.equal(saveRes.success, true);
  const graph = getStudentSkillGraphDto('stu-101');
  const reactNode = graph.nodes.find((n) => n.id === 'node-skill-react');
  assert.equal(reactNode?.position.x, 250);
  assert.equal(reactNode?.position.y, 190);
});

test('SRS: reset restores initial university registration state', () => {
  const reset = resetStudentSkillGraph('stu-101');
  assert.ok(reset.nodes.length >= 6);
  assert.equal(reset.nodes.some((n) => n.isCustom), false);
});

test('UX & Layout: resolveMagneticSpacing separates overlapping nodes and keeps pinned node fixed', () => {
  const graph = resetStudentSkillGraph('stu-101');
  const pinnedId = graph.nodes[0].id;
  const neighborId = graph.nodes[1].id;

  const crowded = graph.nodes.slice(0, 3).map((n, idx) => ({
    ...n,
    position: idx < 2 ? { x: 560, y: 380 } : { x: 580, y: 390 },
  }));

  const spaced = resolveMagneticSpacing(crowded, pinnedId, 16);
  const pinnedAfter = spaced.find((n) => n.id === pinnedId)!;
  const neighborAfter = spaced.find((n) => n.id === neighborId)!;

  assert.equal(pinnedAfter.position.x, 560);
  assert.equal(pinnedAfter.position.y, 380);

  for (let i = 0; i < spaced.length; i++) {
    for (let j = i + 1; j < spaced.length; j++) {
      const a = spaced[i];
      const b = spaced[j];
      const normDist = Math.hypot(
        (b.position.x - a.position.x) / MAGNETIC_MIN_DIST_X,
        (b.position.y - a.position.y) / MAGNETIC_MIN_DIST_Y
      );
      assert.ok(
        normDist >= 0.92,
        `Nodes ${a.id} and ${b.id} remained too close (${normDist.toFixed(2)})`
      );
    }
  }
  assert.ok(
    Math.abs(neighborAfter.position.x - pinnedAfter.position.x) >= SKILL_NODE_WIDTH ||
      Math.abs(neighborAfter.position.y - pinnedAfter.position.y) >= SKILL_NODE_HEIGHT
  );
});

test('UX & Layout: initial stu-101 skill graph nodes have zero bounding-box overlaps', () => {
  const graph = resetStudentSkillGraph('stu-101');
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const a = graph.nodes[i];
      const b = graph.nodes[j];
      const overlapsX = Math.abs(a.position.x - b.position.x) < SKILL_NODE_WIDTH;
      const overlapsY = Math.abs(a.position.y - b.position.y) < SKILL_NODE_HEIGHT;
      assert.equal(
        overlapsX && overlapsY,
        false,
        `Initial boxes ${a.id} and ${b.id} overlap`
      );
    }
  }
});
