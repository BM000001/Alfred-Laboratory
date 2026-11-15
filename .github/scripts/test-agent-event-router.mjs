#!/usr/bin/env node
import { runSelfTests } from "./agent-event-router.mjs";

process.stdout.write(runSelfTests() + "\n");
