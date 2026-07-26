// Fetch a flat list from a batched endpoint, falling back to the old
// per-subject fan-out only while that endpoint is undeployed.
//
// Every flattened faculty screen (Assignments, Quizzes, Study Materials,
// Recordings) has the same shape: one request that returns everything across
// the subjects the teacher is assigned to, with a legacy path that asks each
// subject separately. Rather than repeat the reasoning four times, it lives
// here — in particular the rule about WHICH failures may fall back.
//
// The fallback is deliberately narrow: **404 only**, meaning "this backend
// doesn't have the endpoint yet". Any other status is a real failure and must
// surface. Falling back on, say, a 403 would silently paper over a permission
// problem by re-asking through a different door, and the per-subject endpoints
// enforce their checks one subject at a time rather than in one place.

import api from "./apiClient";

/**
 * @param {string}   url        batched endpoint, e.g. "/assignments/teacher/all/"
 * @param {Function} mapRow     (row) => row, applied to each batched result
 * @param {Function} fanOut     () => Promise<row[]>, the legacy per-subject path
 * @returns {Promise<row[]>}
 */
export async function fetchBatchedOrFanOut(url, mapRow, fanOut) {
  try {
    const res = await api.get(url);
    return (res.data || []).map(mapRow);
  } catch (err) {
    if (err?.response?.status !== 404) throw err;
    return fanOut();
  }
}

/**
 * The legacy path: one request per subject, in parallel, flattened. A subject
 * that fails contributes nothing rather than rejecting the whole screen.
 *
 * @param {Array}    classes  from useTeacherClasses()
 * @param {Function} urlFor   (cls) => string
 * @param {Function} mapRow   (row, cls) => row
 */
export async function fanOutPerSubject(classes, urlFor, mapRow) {
  const perSubject = await Promise.all(
    classes.map((c) =>
      api
        .get(urlFor(c))
        .then((res) => (res.data || []).map((row) => mapRow(row, c)))
        .catch((err) => {
          console.error(`Failed to load list for subject ${c.subjectId}`, err);
          return [];
        })
    )
  );
  return perSubject.flat();
}
