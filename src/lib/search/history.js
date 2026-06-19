"use client";

import Dexie from "dexie";

const DATABASE_NAME = "ose-search";
const MAX_HISTORY_ENTRIES = 20;

let db = null;

function getDb() {
  if (!db) {
    db = new Dexie(DATABASE_NAME);
    db.version(1).stores({
      searches: "++id, query, createdAt",
    });
  }

  return db;
}

export async function saveSearchHistory(query) {
  if (!query.trim()) {
    return;
  }

  const database = getDb();
  const normalizedQuery = query.trim();
  const existingEntries = await database.searches.where("query").equals(normalizedQuery).toArray();
  await Promise.all(existingEntries.map((entry) => database.searches.delete(entry.id)));

  await database.searches.add({
    query: normalizedQuery,
    createdAt: Date.now(),
  });

  const entries = await database.searches.orderBy("createdAt").reverse().toArray();
  const staleEntries = entries.slice(MAX_HISTORY_ENTRIES);
  await Promise.all(staleEntries.map((entry) => database.searches.delete(entry.id)));
}

export async function listSearchHistory() {
  return getDb().searches.orderBy("createdAt").reverse().limit(MAX_HISTORY_ENTRIES).toArray();
}

export async function clearSearchHistory() {
  await getDb().searches.clear();
}
