#!/usr/bin/env node

/* @flow */

import {
	__,
	always,
	assoc,
	pipe,
	prop,
	reduce,
	set,
	lensPath,
	flip,
	map,
	sortBy,
	ifElse,
	equals,
	propSatisfies,
	lte,
	path,
	subtract,
	T,
	includes,
	cond,
	nth,
	not,
	apply,
	both,
	propEq,
	slice,
	over,
	lensProp,
	assocPath,
	add,
	max,
	min,
	lens,
	juxt,
	isNil,
	remove,
	filter,
} from "ramda";
import { Input, Output, State, run } from "eff";

import {
	getNotesOfFolder,
	openFolder,
	getAllFoldersWithChildrenFolders,
	showNote,
	interpretNotes,
	moveNoteToFolder,
	deleteNote,
	createFolder,
} from "./notes.js";
import { activateApplication, interpretSystem } from "./system.js";

// eslint-disable-next-line
const exampleState = {
	folders: {
		containerMap: {},
		allFolders: { name: "", containers: [] },
	},
	notesToTriage: [],
	currentNoteIndex: 0,
	currentInput: {
		substring: "",
		selectedIndex: 0,
		eligibleFolders: [],
	},
};

const substringStartDifference = pipe(
	map(prop("substringStart")),
	apply(subtract),
);

const nameLengthDifference = pipe(
	map(path(["name", "length"])),
	apply(subtract),
);

export const folderSubstringSort = (a, b) =>
	cond([
		[
			both(
				pipe(
					nth(0),
					propSatisfies(includes("4 Archive"))("containers"),
				),
				pipe(
					nth(1),
					propSatisfies(includes("4 Archive"))("containers"),
					not,
				),
			),
			always(1),
		],
		[
			both(
				pipe(
					nth(0),
					propSatisfies(includes("4 Archive"))("containers"),
					not,
				),
				pipe(
					nth(1),
					propSatisfies(includes("4 Archive"))("containers"),
				),
			),
			always(-1),
		],
		[
			pipe(
				substringStartDifference,
				equals(0),
				not,
			),
			substringStartDifference,
		],
		[T, nameLengthDifference],
	])([a, b]);

const ESC = String.fromCharCode(27);

const cursorUpLines = n => `${ESC}[${n}F`;

const cursorHorizontalPosition = n => `${ESC}[${n}G`;

const clearToEndOfScreen = `${ESC}[0J`;

const selectedItemColor = `${ESC}[100;97m`;
const resetColors = `${ESC}[0m`;

const suffix = suffix => string => string + suffix;

const prefix = prefix => string => prefix + string;

const editWithKeypress = cond([
	[
		propEq("name", "backspace"),
		always(over(lensProp("substring"), slice(0, -1))),
	],
	[
		propEq("name", "up"),
		always(
			over(
				lensProp("selectedIndex"),
				pipe(
					flip(subtract)(1),
					max(0),
				),
			),
		),
	],
	[
		propEq("name", "down"),
		always(
			over(
				lens(s => [s.selectedIndex, s.eligibleFolders], assoc("selectedIndex")),
				([selectedIndex, eligibleFolders]) =>
					min(selectedIndex + 1, eligibleFolders.length - 1),
			),
		),
	],
	[
		T,
		pipe(
			prop("string"),
			suffix,
			over(lensProp("substring")),
		),
	],
]);

const updateCurrentInput = keypress =>
	State.modify(over(lensProp("currentInput"), editWithKeypress(keypress)))
		.chain(State.get)
		.map(({ currentInput, folders }) =>
			currentInput.substring.length > 0
				? folders.allFolders
						.map(y => ({
							...y,
							substringStart: y.name
								.toLowerCase()
								.search(currentInput.substring.toLowerCase()),
						}))
						.filter(propSatisfies(lte(0))("substringStart"))
						.sort(folderSubstringSort)
						.slice(0, 4)
				: [],
		)
		.chain(
			pipe(
				assocPath(["currentInput", "eligibleFolders"]),
				State.modify,
			),
		)
		.chain(
			always(
				State.modify(
					over(
						lens(
							s => [
								s.currentInput.selectedIndex,
								s.currentInput.eligibleFolders.length - 1,
							],
							assocPath(["currentInput", "selectedIndex"]),
						),
						pipe(
							apply(min),
							max(0),
						),
					),
				),
			),
		)
		.chain(keyStrokeLoop);

const moveNoteBasedOnCurrentInput = State.get()
	.map(
		juxt([
			pipe(
				state => nth(state.currentNoteIndex)(state.notesToTriage),
				prop("id"),
			),
			state =>
				path(["name"])(
					state.currentInput.eligibleFolders[state.currentInput.selectedIndex],
				),
		]),
	)
	.chain(
		ifElse(args => isNil(args[1]), keyStrokeLoop, x =>
			apply(moveNoteToFolder)(x)
				.chain(State.get)
				.chain(s =>
					State.modify(
						over(lensProp("notesToTriage"), remove(s.currentNoteIndex, 1)),
					),
				),
		),
	);

const activateSelf = always(activateApplication("Terminal"));

const showCurrentNote = always(
	State.get()
		.map(state => nth(state.currentNoteIndex)(state.notesToTriage))
		.chain(
			pipe(
				prop("id"),
				showNote,
			),
		)
		.chain(activateSelf),
);

const deleteNoteWithConfirmation = always(
	Output.putString(
		`${cursorHorizontalPosition(
			1,
		)}${clearToEndOfScreen}Are you sure you want to delete this note? (y/N)`,
	)
		.chain(showCurrentNote)
		.chain(Input.getKeypress)
		.chain(
			cond([
				[
					equals({
						name: "y",
						ctrl: false,
						meta: false,
						shift: false,
						string: "y",
					}),

					always(
						State.get()
							.map(
								pipe(
									state => nth(state.currentNoteIndex)(state.notesToTriage),
									prop("id"),
								),
							)
							.chain(deleteNote)
							.chain(State.get)
							.chain(s =>
								State.modify(
									over(
										lensProp("notesToTriage"),
										remove(s.currentNoteIndex, 1),
									),
								),
							),
					),
				],
				[T, mainLoop],
			]),
		),
);

function folderNameLoop({ folderName, parentFolderName }) {
	return Output.putString(
		`${cursorHorizontalPosition(
			1,
		)}${clearToEndOfScreen}(${parentFolderName}) Name: ${folderName}`,
	)
		.chain(Input.getKeypress)
		.chain(
			cond([
				[
					equals({
						name: "c",
						ctrl: true,
						meta: false,
						shift: false,
						string: "c",
					}),
					pipe(
						always(0),
						process.exit,
					),
				],
				[
					equals({
						name: "return",
						ctrl: false,
						meta: false,
						shift: false,
						string: "\r",
					}),
					always(createFolder({ folderName, parentFolderName })),
				],
				[
					equals({
						name: "backspace",
						ctrl: false,
						meta: false,
						shift: false,
						string: "",
					}),
					() =>
						folderNameLoop({
							folderName: slice(0, -1)(folderName),
							parentFolderName,
						}),
				],
				[
					T,
					({ string }) =>
						folderNameLoop({
							folderName: folderName + string,
							parentFolderName,
						}),
				],
			]),
		);
}

function createNewFolder() {
	return Output.putString(
		`${cursorHorizontalPosition(
			1,
		)}${clearToEndOfScreen}Where should this folder be created?\n1) Projects\n2) Areas\n3) Resources\n4) Archive${cursorUpLines(
			4,
		)}${cursorHorizontalPosition(38)}`,
	)
		.chain(Input.getKeypress)
		.chain(
			cond([
				[
					equals({
						name: "c",
						ctrl: true,
						meta: false,
						shift: false,
						string: "c",
					}),
					pipe(
						always(0),
						process.exit,
					),
				],
				[
					equals({
						name: "1",
						ctrl: false,
						meta: false,
						shift: false,
						string: "1",
					}),
					always(
						folderNameLoop({ folderName: "", parentFolderName: "1 Projects" }),
					),
				],
				[
					equals({
						name: "2",
						ctrl: false,
						meta: false,
						shift: false,
						string: "2",
					}),
					always(
						folderNameLoop({ folderName: "", parentFolderName: "2 Areas" }),
					),
				],
				[
					equals({
						name: "3",
						ctrl: false,
						meta: false,
						shift: false,
						string: "3",
					}),
					always(
						folderNameLoop({ folderName: "", parentFolderName: "3 Resources" }),
					),
				],
				[
					equals({
						name: "4",
						ctrl: false,
						meta: false,
						shift: false,
						string: "4",
					}),
					always(
						folderNameLoop({ folderName: "", parentFolderName: "4 Archive" }),
					),
				],
				[T, () => createNewFolder()],
			]),
		);
}

const nameAsListItem = pipe(
	prop("name"),
	prefix(" * "),
);

function keyStrokeLoop() {
	return State.get()
		.chain(({ currentInput }) =>
			Output.putString(
				`${cursorHorizontalPosition(
					1,
				)}${clearToEndOfScreen}Which folder should this note be moved to ? ${currentInput.substring.toString()}\n${currentInput.eligibleFolders
					.map((folder, index) =>
						index === currentInput.selectedIndex
							? selectedItemColor + nameAsListItem(folder) + " " + resetColors
							: nameAsListItem(folder),
					)
					.map(suffix(`\n`))
					.join(
						"",
					)}(^d = delete, ^n = new folder, ^r = reshow, ^s = skip)${cursorUpLines(
					currentInput.eligibleFolders.length + 1,
				)}${cursorHorizontalPosition(45 + currentInput.substring.length)}`,
			),
		)
		.chain(Input.getKeypress)
		.chain(
			cond([
				[
					equals({
						name: "c",
						ctrl: true,
						meta: false,
						shift: false,
						string: "c",
					}),
					pipe(
						always(0),
						process.exit,
					),
				],
				[
					equals({
						name: "s",
						ctrl: true,
						meta: false,
						shift: false,
						string: "s",
					}),
					always(State.modify(over(lensProp("currentNoteIndex"), add(1)))),
				],
				[
					equals({
						name: "r",
						ctrl: true,
						meta: false,
						shift: false,
						string: "r",
					}),
					mainLoop,
				],
				[
					equals({
						name: "d",
						ctrl: true,
						meta: false,
						shift: false,
						string: "d",
					}),
					deleteNoteWithConfirmation,
				],
				[
					equals({
						name: "n",
						ctrl: true,
						meta: false,
						shift: false,
						string: "n",
					}),
					createNewFolder,
				],
				[
					equals({
						name: "return",
						ctrl: false,
						meta: false,
						shift: false,
						string: "\r",
					}),
					always(moveNoteBasedOnCurrentInput),
				],
				[T, updateCurrentInput],
			]),
		);
}

function mainLoop() {
	return showCurrentNote()
		.chain(
			always(State.modify(assocPath(["currentInput", "eligibleFolders"])([]))),
		)
		.chain(always(State.modify(assocPath(["currentInput", "substring"])(""))))
		.chain(
			always(State.modify(assocPath(["currentInput", "selectedIndex"])(0))),
		)
		.chain(keyStrokeLoop)
		.chain(mainLoop);
}

const containersFromMapping = containerMap => folder =>
	containerMap[folder]
		? [containerMap[folder]].concat(
				containersFromMapping(containerMap)(containerMap[folder]),
		  )
		: [];

const addFoldersToState = getAllFoldersWithChildrenFolders()
	.map(
		reduce(
			(containerMap, container) => ({
				...containerMap,
				...reduce(flip(assoc(__, container.name)))({})(container.folders),
			}),
			{},
		),
	)
	.map(set(lensPath(["folders", "containerMap"])))
	.chain(State.modify)
	.chain(State.get)
	.map(path(["folders", "containerMap"]))
	.map(containerMap =>
		map(folder => ({
			name: folder,
			containers: containersFromMapping(containerMap)(folder),
		}))(Object.keys(containerMap)),
	)
	.map(set(lensPath(["folders", "allFolders"])))
	.chain(State.modify);

const addNotesToTriageToState = getNotesOfFolder("Notes")
	.map(sortBy(prop("modificationDate")))
	.map(filter(note => note.name !== "Daily Focus"))
	.chain(
		pipe(
			assoc("notesToTriage"),
			State.modify,
		),
	);

const application = openFolder("Notes")
	.chain(always(addFoldersToState))
	.chain(always(addNotesToTriageToState))
	.chain(activateSelf)
	.chain(mainLoop);

run(
	Output.interpretOutputStdOut,
	Input.interpretInputStdIn,
	State.interpretState({ currentNoteIndex: 0 }),
	interpretSystem,
	interpretNotes,
)(() => console.log("All done"))(application); // eslint-disable-line no-console, no-undef
