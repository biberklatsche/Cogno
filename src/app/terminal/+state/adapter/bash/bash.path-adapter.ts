import {BasePathAdapter} from "../base/base-path.adapter";
import {ShellType} from "../../../../config/+models/shell-config";
import {OsType} from "../../../../_tauri/os";

export class BashPathAdapter extends BasePathAdapter {
    shellType: ShellType = "Bash";
}
