/* @flow */

import daggy from "daggy";
import { Eff, send, interpreter } from "eff";
import applescript from "@eric.dahlseng/applescript";

const System = daggy.taggedSum("System", {
	getFrontmostApplication: [],
	activateApplication: ["applicationName"],
	keyPress: ["key"],
	keyCode: ["code"],
});

export const getFrontmostApplication = () =>
	send(System.getFrontmostApplication);

export const activateApplication = (applicationName: string) =>
	send(System.activateApplication(applicationName));

export const keyPress = (k: string) => send(System.keyPress(k));

export const keyCode = (k: string) => send(System.keyCode(k));

export const interpretSystem = interpreter({
	onPure: Eff.Pure,
	predicate: x => System.is(x),
	handler: systemEventsEffect =>
		systemEventsEffect.cata({
			keyPress: k => continuation => {
				applescript.execString(
					`tell application "System Events" to keystroke "${k}"`,
					(err, result) => continuation(result),
				);
			},
			keyCode: k => continuation => {
				applescript.execString(
					`tell application "System Events" to key code ${k}`,
					(err, result) => continuation(result),
				);
			},
			getFrontmostApplication: () => continuation => {
				applescript.execString(
					'tell application "System Events" to get name of first application process whose frontmost is true',
					(err, result) => continuation(result),
				);
			},
			activateApplication: applicationName => continuation => {
				applescript.execString(
					`activate application "${applicationName}"`,
					(err, result) => continuation(result),
				);
			},
		}),
});
