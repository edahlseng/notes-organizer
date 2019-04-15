/* @flow */

import daggy from "daggy";
import { map, zip } from "ramda";
import { Eff, send, interpreter } from "eff";

import applescript from "@eric.dahlseng/applescript";

const Notes = daggy.taggedSum("Notes", {
	openFolder: ["folderName"],
	getAllFoldersWithChildrenFolders: [],
	getNotesOfFolder: ["folderName"],
	getFoldersOfFolder: ["folderName"],
	showNote: ["noteId"],
	moveNoteToFolder: ["noteId", "folderName"],
	deleteNote: ["noteId"],
	createFolder: ["folderName", "parentFolderName"],
});

export const openFolder = folderName => send(Notes.openFolder(folderName));
export const getAllFoldersWithChildrenFolders = () =>
	send(Notes.getAllFoldersWithChildrenFolders);
export const getNotesOfFolder = folderName =>
	send(Notes.getNotesOfFolder(folderName));
export const getFoldersOfFolder = folderName =>
	send(Notes.getFoldersOfFolder(folderName));
export const showNote = noteId => send(Notes.showNote(noteId));
export const moveNoteToFolder = (noteId, folderName) =>
	send(Notes.moveNoteToFolder(noteId, folderName));
export const deleteNote = noteId => send(Notes.deleteNote(noteId));
export const createFolder = ({ folderName, parentFolderName }) =>
	send(Notes.createFolder(folderName, parentFolderName));

export const interpretNotes = interpreter({
	onPure: Eff.Pure,
	predicate: x => Notes.is(x),
	handler: notesEffect =>
		notesEffect.cata({
			openFolder: folderName => continuation => {
				applescript.execString(
					`tell application "Notes" to show folder "${folderName}"`,
					(err, result) => continuation(result),
				);
			},
			getAllFoldersWithChildrenFolders: () => continuation => {
				applescript.execString(
					`tell application "Notes" to get {name, name of folders} of folders`,
					(err, result) =>
						continuation(
							map(([name, folders]) => ({ name, folders }))(
								zip(result[0], result[1]),
							),
						),
				);
			},
			getNotesOfFolder: folderName => continuation => {
				applescript.execString(
					`tell application "Notes" to get {id, modification date} of notes in folder "${folderName}"`,
					(err, result) =>
						continuation(
							map(([id, modificationDate]) => ({ id, modificationDate }))(
								zip(result[0], result[1]),
							),
						),
				);
			},
			getFoldersOfFolder: folderName => continuation =>
				applescript.execString(
					`tell application "Notes" to get name of folders of folder "${folderName}"`,
					(err, result) => continuation(result),
				),
			showNote: noteId => continuation =>
				applescript.execString(
					`tell application "Notes" to show note id "${noteId}"`,
					(err, result) => continuation(result),
				),
			moveNoteToFolder: (noteId, folderName) => continuation =>
				applescript.execString(
					`tell application "Notes" to move note id "${noteId}" to folder "${folderName}"`,
					(err, result) => continuation(result),
				),
			deleteNote: noteId => continuation =>
				applescript.execString(
					`tell application "Notes" to delete note id "${noteId}"`,
					(err, result) => continuation(result),
				),
			createFolder: (folderName, parentFolderName) => continuation =>
				applescript.execString(
					`tell application "Notes" to make new folder at folder "${parentFolderName}" with properties {name: "${folderName}"}`,
					(err, result) => continuation(result),
				),
		}),
});
