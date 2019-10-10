/* @flow */

import daggy from "daggy";
import { map, zip } from "ramda";
import { Eff, send, interpreter } from "eff";

import applescript from "@eric.dahlseng/applescript";

const zip3 = (x, y, z) => {
	const length = Math.min(x.length, y.length, z.length);
	const result = new Array(length);
	for (let i = 0; i < length; i++) {
		result[i] = [x[i], y[i], z[i]];
	}
	return result;
};

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

export const openFolder = (folderName: string) =>
	send(Notes.openFolder(folderName));
export const getAllFoldersWithChildrenFolders = () =>
	send(Notes.getAllFoldersWithChildrenFolders);
export const getNotesOfFolder = (folderName: string) =>
	send(Notes.getNotesOfFolder(folderName));
export const getFoldersOfFolder = (folderName: string) =>
	send(Notes.getFoldersOfFolder(folderName));
export const showNote = (noteId: string) => send(Notes.showNote(noteId));
export const moveNoteToFolder = (noteId: string, folderName: string) =>
	send(Notes.moveNoteToFolder(noteId, folderName));
export const deleteNote = (noteId: string) => send(Notes.deleteNote(noteId));
export const createFolder = ({
	folderName,
	parentFolderName,
}: {
	folderName: string,
	parentFolderName: string,
}) => send(Notes.createFolder(folderName, parentFolderName));

export const interpretNotes = interpreter({
	onPure: Eff.Pure,
	predicate: x => Notes.is(x),
	handler: notesEffect =>
		notesEffect.cata({
			openFolder: folderName => continuation => {
				applescript.execString(
					`tell application "Notes" to show folder "${folderName}" of account "iCloud"`,
					(err, result) => continuation(result),
				);
			},
			getAllFoldersWithChildrenFolders: () => continuation => {
				applescript.execString(
					`tell application "Notes" to get {name, name of folders} of folders of account "iCloud"`,
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
					`tell application "Notes" to get {id, name, modification date} of notes in folder "${folderName}" in account "iCloud"`,
					(err, result) =>
						continuation(
							map(([id, name, modificationDate]) => ({
								id,
								modificationDate,
								name,
							}))(zip3(result[0], result[1], result[2])),
						),
				);
			},
			getFoldersOfFolder: folderName => continuation =>
				applescript.execString(
					`tell application "Notes" to get name of folders of folder "${folderName}" in account "iCloud"`,
					(err, result) => continuation(result),
				),
			showNote: noteId => continuation =>
				applescript.execString(
					`tell application "Notes" to show note id "${noteId}" of account "iCloud"`,
					(err, result) => continuation(result),
				),
			moveNoteToFolder: (noteId, folderName) => continuation =>
				applescript.execString(
					`tell application "Notes" to move note id "${noteId}" of account "iCloud" to folder "${folderName}" in account "iCloud"`,
					(err, result) => continuation(result),
				),
			deleteNote: noteId => continuation =>
				applescript.execString(
					`tell application "Notes" to delete note id "${noteId}" in account "iCloud"`,
					(err, result) => continuation(result),
				),
			createFolder: (folderName, parentFolderName) => continuation =>
				applescript.execString(
					`tell application "Notes" to make new folder at folder "${parentFolderName}" in account "iCloud" with properties {name: "${folderName}"}`,
					(err, result) => continuation(result),
				),
		}),
});
