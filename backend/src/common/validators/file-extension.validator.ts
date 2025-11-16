import { FileValidator } from '@nestjs/common';

export interface FileExtensionValidatorOptions {
  allowedExtensions: RegExp; // 예: /\.(jpg|png)$/i
}

export class FileExtensionValidator extends FileValidator<FileExtensionValidatorOptions> {
  constructor(
    protected readonly validationOptions: FileExtensionValidatorOptions,
  ) {
    super(validationOptions);
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }
    // file.mimetype 대신 file.originalname의 확장자를 검사
    return this.validationOptions.allowedExtensions.test(file.originalname);
  }

  buildErrorMessage(): string {
    return `Validation failed (File extension does not match allowed types: ${this.validationOptions.allowedExtensions})`;
  }
}
