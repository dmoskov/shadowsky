/**
 * Third-Party Labeler Service — now sourced from the shared @bsky/core package.
 *
 * This module remains the web entry point for the labeler API; the canonical
 * implementation lives in @bsky/core (consumed by both web and mobile).
 */

import { labelers } from "@bsky/core";

export type LabelerInfo = labelers.LabelerInfo;
export type LabelerSubscription = labelers.LabelerSubscription;
export type LabelerLabelPreference = labelers.LabelerLabelPreference;
export type LabelerDirectoryEntry = labelers.LabelerDirectoryEntry;
export type LabelerCategory = labelers.LabelerCategory;

export const LABELER_CATEGORIES = labelers.LABELER_CATEGORIES;
export const CURATED_LABELERS = labelers.CURATED_LABELERS;

export const getSubscribedLabelers = labelers.getSubscribedLabelers;
export const getPopularLabelers = labelers.getPopularLabelers;
export const searchLabelers = labelers.searchLabelers;
export const subscribeToLabeler = labelers.subscribeToLabeler;
export const unsubscribeFromLabeler = labelers.unsubscribeFromLabeler;
export const getLabelerInfo = labelers.getLabelerInfo;
export const getLabelerLabelPreferences = labelers.getLabelerLabelPreferences;
export const setLabelerLabelPreference = labelers.setLabelerLabelPreference;
export const likeLabeler = labelers.likeLabeler;
export const unlikeLabeler = labelers.unlikeLabeler;
