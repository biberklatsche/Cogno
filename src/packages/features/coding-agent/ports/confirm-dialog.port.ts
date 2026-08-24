export abstract class ConfirmDialogPort {
  abstract confirm(title: string, message: string): Promise<boolean>;
}
