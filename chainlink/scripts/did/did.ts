import { BigBSLStatus } from "./bigBSLStatus";
import { BSLStatus } from "./bslStatus";
import { MTStatus } from "./mtStatus";

export type DIDStatus = BSLStatus | BigBSLStatus | MTStatus;