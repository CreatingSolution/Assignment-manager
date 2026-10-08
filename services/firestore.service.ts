import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from './firebase.config';
import type { Assignment, Course, Submission, Task, User } from '../types';

/**
 * Cloud Firestore Service
 *
 * Provides typed methods for synchronizing and retrieving local SQLite data
 * with Cloud Firestore collections.
 *
 * Data Hierarchy in Firestore:
 * - users/{userId} (profile)
 * - users/{userId}/courses/{courseId}
 * - users/{userId}/assignments/{assignmentId}
 * - users/{userId}/assignments/{assignmentId}/tasks/{taskId}
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDb() {
  if (!isFirebaseConfigured() || !firestoreDb) {
    throw new Error('Firebase Firestore is not configured. Please check your .env settings.');
  }
  return firestoreDb;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function saveUserProfileToFirestore(user: User): Promise<void> {
  const db = getDb();
  const userRef = doc(db, 'users', user.id);
  await setDoc(
    userRef,
    {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name ?? null,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
      updatedAt: Date.now(),
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function fetchUserProfileFromFirestore(userId: string): Promise<User | null> {
  const db = getDb();
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: data.id,
    email: data.email,
    username: data.username,
    name: data.name ?? undefined,
    avatarColor: data.avatarColor,
    createdAt: data.createdAt,
  };
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export async function syncAssignmentToFirestore(
  userId: string,
  assignment: Assignment
): Promise<void> {
  const db = getDb();
  const assignmentRef = doc(db, 'users', userId, 'assignments', assignment.id);
  await setDoc(
    assignmentRef,
    {
      id: assignment.id,
      userId: assignment.userId,
      courseId: assignment.courseId || null,
      title: assignment.title,
      description: assignment.description ?? null,
      sourceUrl: assignment.sourceUrl ?? null,
      priority: assignment.priority,
      totalMarks: assignment.totalMarks ?? null,
      deadline: assignment.deadline,
      estimatedHours: assignment.estimatedHours ?? null,
      estimatedDays: assignment.estimatedDays ?? null,
      hoursPerDay: assignment.hoursPerDay ?? null,
      status: assignment.status,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      isDeleted: assignment.isDeleted ? true : false,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteAssignmentFromFirestore(
  userId: string,
  assignmentId: string
): Promise<void> {
  const db = getDb();
  const assignmentRef = doc(db, 'users', userId, 'assignments', assignmentId);
  // Mark as isDeleted in Firestore so other offline devices observe the deletion
  await setDoc(
    assignmentRef,
    {
      isDeleted: true,
      updatedAt: Date.now(),
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export async function syncCourseToFirestore(
  userId: string,
  course: Course
): Promise<void> {
  const db = getDb();
  const courseRef = doc(db, 'users', userId, 'courses', course.id);
  await setDoc(
    courseRef,
    {
      id: course.id,
      userId: course.userId,
      code: course.code,
      title: course.title,
      color: course.color,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      isDeleted: course.isDeleted ? true : false,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteCourseFromFirestore(
  userId: string,
  courseId: string
): Promise<void> {
  const db = getDb();
  const courseRef = doc(db, 'users', userId, 'courses', courseId);
  await setDoc(
    courseRef,
    {
      isDeleted: true,
      updatedAt: Date.now(),
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ─── Tasks / Subtasks ─────────────────────────────────────────────────────────

export async function syncTaskToFirestore(
  userId: string,
  assignmentId: string,
  task: Task
): Promise<void> {
  const db = getDb();
  const taskRef = doc(db, 'users', userId, 'assignments', assignmentId, 'tasks', task.id);
  await setDoc(
    taskRef,
    {
      id: task.id,
      assignmentId: task.assignmentId,
      submissionId: task.submissionId ?? null,
      userId: task.userId,
      title: task.title,
      description: task.description ?? null,
      targetDate: task.targetDate ?? null,
      estimatedHours: task.estimatedHours ?? null,
      status: task.status,
      orderIndex: task.orderIndex,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      isDeleted: task.isDeleted ? true : false,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteTaskFromFirestore(
  userId: string,
  assignmentId: string,
  taskId: string
): Promise<void> {
  const db = getDb();
  const taskRef = doc(db, 'users', userId, 'assignments', assignmentId, 'tasks', taskId);
  await setDoc(
    taskRef,
    {
      isDeleted: true,
      updatedAt: Date.now(),
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ─── Bulk Fetch from Firestore ────────────────────────────────────────────────

export interface RemoteUserData {
  assignments: Assignment[];
  courses: Course[];
  tasks: Task[];
}

export async function fetchRemoteUserData(userId: string): Promise<RemoteUserData> {
  const db = getDb();

  // 1. Fetch Courses
  const coursesCol = collection(db, 'users', userId, 'courses');
  const courseSnaps = await getDocs(coursesCol);
  const courses: Course[] = courseSnaps.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id ?? d.id,
      userId: data.userId ?? userId,
      code: data.code ?? '',
      title: data.title ?? '',
      color: data.color ?? '#3B82F6',
      createdAt: data.createdAt ?? Date.now(),
      updatedAt: data.updatedAt ?? Date.now(),
      isSynced: true,
      isDeleted: Boolean(data.isDeleted),
    };
  });

  // 2. Fetch Assignments
  const assignmentsCol = collection(db, 'users', userId, 'assignments');
  const assignmentSnaps = await getDocs(assignmentsCol);
  const assignments: Assignment[] = [];
  const tasks: Task[] = [];

  for (const aDoc of assignmentSnaps.docs) {
    const aData = aDoc.data();
    const assignment: Assignment = {
      id: aData.id ?? aDoc.id,
      userId: aData.userId ?? userId,
      courseId: aData.courseId ?? '',
      title: aData.title ?? '',
      description: aData.description ?? undefined,
      sourceUrl: aData.sourceUrl ?? undefined,
      priority: aData.priority ?? 'medium',
      totalMarks: aData.totalMarks ?? undefined,
      deadline: aData.deadline ?? new Date().toISOString(),
      estimatedHours: aData.estimatedHours ?? undefined,
      estimatedDays: aData.estimatedDays ?? undefined,
      hoursPerDay: aData.hoursPerDay ?? undefined,
      status: aData.status ?? 'pending',
      createdAt: aData.createdAt ?? Date.now(),
      updatedAt: aData.updatedAt ?? Date.now(),
      isSynced: true,
      isDeleted: Boolean(aData.isDeleted),
    };
    assignments.push(assignment);

    // 3. Fetch subtasks for this assignment
    try {
      const tasksCol = collection(db, 'users', userId, 'assignments', assignment.id, 'tasks');
      const taskSnaps = await getDocs(tasksCol);
      for (const tDoc of taskSnaps.docs) {
        const tData = tDoc.data();
        tasks.push({
          id: tData.id ?? tDoc.id,
          assignmentId: assignment.id,
          submissionId: tData.submissionId ?? undefined,
          userId: tData.userId ?? userId,
          title: tData.title ?? '',
          description: tData.description ?? undefined,
          targetDate: tData.targetDate ?? undefined,
          estimatedHours: tData.estimatedHours ?? undefined,
          status: tData.status ?? 'pending',
          orderIndex: tData.orderIndex ?? 0,
          createdAt: tData.createdAt ?? Date.now(),
          updatedAt: tData.updatedAt ?? Date.now(),
          isSynced: true,
          isDeleted: Boolean(tData.isDeleted),
        });
      }
    } catch (e) {
      console.warn(`[Firestore] Failed to fetch tasks for assignment ${assignment.id}:`, e);
    }
  }

  return { assignments, courses, tasks };
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export async function syncSubmissionToFirestore(
  userId: string,
  submission: Submission
): Promise<void> {
  const db = getDb();
  if (submission.assignmentId) {
    const subRef = doc(
      db,
      'users',
      userId,
      'assignments',
      submission.assignmentId,
      'submissions',
      submission.id
    );
    await setDoc(
      subRef,
      {
        id: submission.id,
        assignmentId: submission.assignmentId,
        userId: submission.userId,
        title: submission.title,
        deadline: submission.deadline,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else if (submission.groupId) {
    const subRef = doc(
      db,
      'groups',
      submission.groupId,
      'submissions',
      submission.id
    );
    await setDoc(
      subRef,
      {
        id: submission.id,
        groupId: submission.groupId,
        userId: submission.userId,
        title: submission.title,
        deadline: submission.deadline,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

// ─── Group Assignments ────────────────────────────────────────────────────────

export async function syncGroupToFirestore(
  group: { id: string; name: string; accessToken: string; adminUserId: string; assignmentId?: string },
  members: Array<{ id: string; groupId: string; userId: string; status: string; joinedAt?: number }>,
  tasks: Array<{ id: string; groupId: string; title: string; description?: string; targetDate?: string; status: string; createdByUserId: string }>
): Promise<void> {
  const db = getDb();
  const groupRef = doc(db, 'groups', group.id);
  await setDoc(
    groupRef,
    {
      id: group.id,
      name: group.name,
      accessToken: group.accessToken,
      adminUserId: group.adminUserId,
      assignmentId: group.assignmentId ?? null,
      members,
      tasks,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteGroupFromFirestore(groupId: string): Promise<void> {
  const db = getDb();
  const groupRef = doc(db, 'groups', groupId);
  await deleteDoc(groupRef);
}

export async function checkFirestoreUsernameTaken(username: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !firestoreDb) return false;
  try {
    const clean = username.trim().toLowerCase();
    // Query users collection for username matches
    const usersRef = collection(firestoreDb, 'users');
    const q = query(usersRef, where('username', '==', clean));
    const snap = await getDocs(q);
    if (!snap.empty) return true;

    // Check with original casing as well in case saved without lowercase
    if (clean !== username.trim()) {
      const qOriginal = query(usersRef, where('username', '==', username.trim()));
      const snapOriginal = await getDocs(qOriginal);
      if (!snapOriginal.empty) return true;
    }

    return false;
  } catch (error) {
    console.warn('[Firestore] checkFirestoreUsernameTaken warning:', error);
    return false;
  }
}


