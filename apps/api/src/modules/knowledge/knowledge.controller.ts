import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireOperationalMemberAccess } from '../auth/roles.decorator';
import { sanitizeNullableText } from '../shared/url.utils';
import { KnowledgeService, type KnowledgeUploadFile } from './knowledge.service';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getStringValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
};

type ParsedMultipartBody = {
  fields: Record<string, string>;
  file: KnowledgeUploadFile | null;
};

const getMultipartBoundary = (contentType: string | undefined) => {
  const match = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return sanitizeNullableText(match?.[1] ?? match?.[2]);
};

const getHeaderValue = (headers: Record<string, string>, name: string) =>
  headers[name.toLowerCase()];

const parseHeaderParameters = (value: string | undefined) => {
  const parameters: Record<string, string> = {};

  if (!value) {
    return parameters;
  }

  const parameterPattern = /;\s*([^=;\s]+)=("(?:\\"|[^"])*"|[^;]*)/g;
  let match: RegExpExecArray | null = null;

  while ((match = parameterPattern.exec(value)) !== null) {
    const rawValue = match[2] ?? '';
    parameters[match[1].toLowerCase()] = rawValue.startsWith('"')
      ? rawValue.slice(1, -1).replace(/\\"/g, '"')
      : rawValue.trim();
  }

  return parameters;
};

const parseMultipartBody = (
  body: unknown,
  contentType: string | undefined,
): ParsedMultipartBody => {
  if (!Buffer.isBuffer(body)) {
    throw new BadRequestException({
      code: 'KNOWLEDGE_UPLOAD_MULTIPART_REQUIRED',
      message: 'The upload request must be multipart/form-data.',
    });
  }

  const boundaryValue = getMultipartBoundary(contentType);

  if (!boundaryValue) {
    throw new BadRequestException({
      code: 'KNOWLEDGE_UPLOAD_BOUNDARY_REQUIRED',
      message: 'The multipart boundary is required.',
    });
  }

  const boundary = Buffer.from(`--${boundaryValue}`, 'utf8');
  const headerSeparator = Buffer.from('\r\n\r\n', 'utf8');
  const fields: Record<string, string> = {};
  let file: KnowledgeUploadFile | null = null;
  let position = body.indexOf(boundary);

  while (position !== -1) {
    position += boundary.length;

    if (body[position] === 45 && body[position + 1] === 45) {
      break;
    }

    if (body[position] === 13 && body[position + 1] === 10) {
      position += 2;
    }

    const headerEnd = body.indexOf(headerSeparator, position);

    if (headerEnd === -1) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_UPLOAD_MULTIPART_INVALID',
        message: 'The multipart payload is malformed.',
      });
    }

    const headers = body
      .subarray(position, headerEnd)
      .toString('latin1')
      .split('\r\n')
      .reduce<Record<string, string>>((accumulator, line) => {
        const separatorIndex = line.indexOf(':');

        if (separatorIndex > 0) {
          accumulator[line.slice(0, separatorIndex).trim().toLowerCase()] = line
            .slice(separatorIndex + 1)
            .trim();
        }

        return accumulator;
      }, {});
    const dataStart = headerEnd + headerSeparator.length;
    const nextBoundary = body.indexOf(boundary, dataStart);

    if (nextBoundary === -1) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_UPLOAD_MULTIPART_INVALID',
        message: 'The multipart payload is incomplete.',
      });
    }

    const dataEnd =
      body[nextBoundary - 2] === 13 && body[nextBoundary - 1] === 10
        ? nextBoundary - 2
        : nextBoundary;
    const data = body.subarray(dataStart, dataEnd);
    const disposition = getHeaderValue(headers, 'content-disposition');
    const parameters = parseHeaderParameters(disposition);
    const fieldName = sanitizeNullableText(parameters.name);
    const fileName = sanitizeNullableText(parameters.filename);

    if (fieldName) {
      if (fileName) {
        file = {
          buffer: Buffer.from(data),
          filename: fileName,
          mimeType:
            sanitizeNullableText(getHeaderValue(headers, 'content-type')) ??
            'application/pdf',
        };
      } else {
        fields[fieldName] = data.toString('utf8');
      }
    }

    position = nextBoundary;
  }

  return { fields, file };
};

@Controller('knowledge')
@RequireOperationalMemberAccess()
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('list')
  listDocuments(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('tenant_id') tenantIdQuery?: string,
  ) {
    const tenantId = sanitizeNullableText(tenantIdQuery);

    if (!tenantId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_TENANT_ID_REQUIRED',
        message: 'tenant_id is required.',
      });
    }

    if (tenantId !== user.teamId) {
      throw new ForbiddenException({
        code: 'KNOWLEDGE_TENANT_SCOPE_INVALID',
        message: 'The requested knowledge tenant is outside your team scope.',
      });
    }

    return this.knowledgeService.listDocuments({ tenantId });
  }

  @Get('audit')
  listAudit(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('tenant_id') tenantIdQuery?: string,
  ) {
    const tenantId = this.resolveTenantScope(user, tenantIdQuery);

    return this.knowledgeService.listAudit({ tenantId });
  }

  @Post('audit')
  recordAudit(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Query('tenant_id') tenantIdQuery?: string,
  ) {
    const record = isRecord(body) ? body : {};
    const tenantId = this.resolveTenantScope(
      user,
      tenantIdQuery ?? getStringValue(record, ['tenant_id', 'tenantId']),
    );
    const operation = sanitizeNullableText(getStringValue(record, ['operation']));
    const fileName = sanitizeNullableText(
      getStringValue(record, ['file_name', 'fileName', 'name']),
    );

    if (operation !== 'upload' && operation !== 'delete') {
      throw new BadRequestException({
        code: 'KNOWLEDGE_AUDIT_OPERATION_INVALID',
        message: 'operation must be upload or delete.',
      });
    }

    if (!fileName) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_AUDIT_FILE_NAME_REQUIRED',
        message: 'file_name is required.',
      });
    }

    return this.knowledgeService.recordAudit({
      tenantId,
      user,
      operation,
      fileName,
      documentId: sanitizeNullableText(
        getStringValue(record, ['document_id', 'documentId', 'file_id', 'fileId']),
      ),
      costKredits: sanitizeNullableText(
        getStringValue(record, ['cost_kredits', 'costKredits', 'training_cost_kredits']),
      ),
    });
  }

  @Post('upload')
  uploadDocument(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Headers('content-type') contentType?: string,
  ) {
    const { fields, file } = parseMultipartBody(body, contentType);
    const tenantId = this.resolveTenantScope(
      user,
      getStringValue(fields, ['tenant_id', 'tenantId']),
    );

    if (!file) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_UPLOAD_FILE_REQUIRED',
        message: 'A PDF file is required.',
      });
    }

    return this.knowledgeService.uploadDocument({
      tenantId,
      user,
      file,
      metadata: fields,
      costKredits: sanitizeNullableText(
        getStringValue(fields, [
          'cost',
          'cost_kredits',
          'costKredits',
          'training_cost_kredits',
          'trainingCostKredits',
        ]),
      ),
    });
  }

  @Delete('delete')
  deleteDocument(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const record = isRecord(body) ? body : {};
    const tenantId = this.resolveTenantScope(
      user,
      getStringValue(record, ['tenant_id', 'tenantId']),
    );
    const fileName = sanitizeNullableText(
      getStringValue(record, ['file_name', 'fileName', 'name']),
    );

    if (!fileName) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_DELETE_FILE_NAME_REQUIRED',
        message: 'file_name is required.',
      });
    }

    return this.knowledgeService.deleteDocument({
      tenantId,
      user,
      fileName,
      documentId: sanitizeNullableText(
        getStringValue(record, ['document_id', 'documentId', 'file_id', 'fileId']),
      ),
    });
  }

  @Delete(':id')
  deleteDocumentById(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Param('id') documentIdParam: string,
    @Query('tenant_id') tenantIdQuery?: string,
    @Body() body?: unknown,
  ) {
    const record = isRecord(body) ? body : {};
    const tenantId = this.resolveTenantScope(
      user,
      tenantIdQuery ?? getStringValue(record, ['tenant_id', 'tenantId']),
    );
    const documentId = sanitizeNullableText(documentIdParam);

    if (!documentId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_DOCUMENT_ID_REQUIRED',
        message: 'Knowledge document id is required.',
      });
    }

    return this.knowledgeService.deleteDocumentById({
      tenantId,
      user,
      documentId,
      fileName:
        sanitizeNullableText(
          getStringValue(record, ['file_name', 'fileName', 'name']),
        ) ?? documentId,
    });
  }

  private resolveTenantScope(user: AuthenticatedUser, tenantIdValue?: string) {
    const tenantId = sanitizeNullableText(tenantIdValue);

    if (!tenantId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_TENANT_ID_REQUIRED',
        message: 'tenant_id is required.',
      });
    }

    if (tenantId !== user.teamId) {
      throw new ForbiddenException({
        code: 'KNOWLEDGE_TENANT_SCOPE_INVALID',
        message: 'The requested knowledge tenant is outside your team scope.',
      });
    }

    return tenantId;
  }
}
