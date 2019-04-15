/* @flow */

import test from "ava";

import { folderSubstringSort } from "./index";

test("Folder substring sort", t => {
	// Substring start
	t.is(
		folderSubstringSort(
			{ name: "blah", containers: [], substringStart: 0 },
			{ name: "blah", containers: [], substringStart: 2 },
		),
		-2,
	);
	t.is(
		folderSubstringSort(
			{ name: "blah", containers: [], substringStart: 2 },
			{ name: "blah", containers: [], substringStart: 0 },
		),
		2,
	);

	// Name length
	t.is(
		folderSubstringSort(
			{ name: "blahblah", containers: [], substringStart: 0 },
			{ name: "blah", containers: [], substringStart: 0 },
		),
		4,
	);
	t.is(
		folderSubstringSort(
			{ name: "blah", containers: [], substringStart: 0 },
			{ name: "blahblah", containers: [], substringStart: 0 },
		),
		-4,
	);

	// One in archive folder
	t.is(
		folderSubstringSort(
			{ name: "blah", containers: ["4 Archive"], substringStart: 0 },
			{ name: "blah", containers: [], substringStart: 0 },
		),
		1,
	);
	t.is(
		folderSubstringSort(
			{ name: "blah", containers: [], substringStart: 0 },
			{ name: "blah", containers: ["4 Archive"], substringStart: 0 },
		),
		-1,
	);

	// Both in Archive folder
	t.is(
		folderSubstringSort(
			{ name: "blah", containers: ["4 Archive"], substringStart: 1 },
			{ name: "blah", containers: ["4 Archive"], substringStart: 0 },
		),
		1,
	);
	t.is(
		folderSubstringSort(
			{ name: "blah", containers: ["4 Archive"], substringStart: 0 },
			{ name: "blah", containers: ["4 Archive"], substringStart: 1 },
		),
		-1,
	);
});
