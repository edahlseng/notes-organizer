/* @flow */

import daggy from "daggy";
import { Eff, send, interpreter } from "eff";
import applescript from "@eric.dahlseng/applescript";

const System = daggy.taggedSum("System", {
	getFrontmostApplication: [],
	activateApplication: ["applicationName"],
});

export const getFrontmostApplication = () =>
	send(System.getFrontmostApplication);

export const activateApplication = applicationName =>
	send(System.activateApplication(applicationName));

export const interpretSystem = interpreter({
	onPure: Eff.Pure,
	predicate: x => System.is(x),
	handler: systemEventsEffect =>
		systemEventsEffect.cata({
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
