/* @flow */

import { Input, Output, State, run } from "eff";

import { application } from "./index.js";
import { interpretSystem } from "./system.js";
import { interpretNotes } from "./notes.js";

run(
	Output.interpretOutputStdOut,
	Input.interpretInputStdIn,
	State.interpretState({ currentNoteIndex: 0 }),
	interpretSystem,
	interpretNotes,
)(() => console.log("All done"))(application); // eslint-disable-line no-console, no-undef
