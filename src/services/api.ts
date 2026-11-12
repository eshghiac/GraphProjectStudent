import {
  GraphResponseDto,
  RoomDetailDto,
  SessionAccountOption,
  StudentPublicDetailDto,
} from '../domain/types';

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

function buildAuthHeaders(sessionToken: string, simulateOutage = false): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${sessionToken}`,
  };
  if (simulateOutage) {
    headers['X-Simulate-Service-Unavailable'] = '1';
  }
  return headers;
}

async function parseApiJson<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError(
      'دریافت اطلاعات خوابگاه با مشکل مواجه شد. لطفاً دوباره تلاش کنید.',
      response.status || 500,
      'INVALID_JSON'
    );
  }

  if (!response.ok) {
    const errObj = payload as { message?: string; errorCode?: string } | null;
    throw new ApiRequestError(
      errObj?.message || 'دریافت اطلاعات خوابگاه با مشکل مواجه شد. لطفاً دوباره تلاش کنید.',
      response.status,
      errObj?.errorCode || 'HTTP_ERROR'
    );
  }

  return payload as T;
}

export async function fetchMyDormitoryGraph(
  sessionToken: string,
  simulateOutage = false
): Promise<GraphResponseDto> {
  const response = await fetch('/api/v1/graph/dormitory/me', {
    method: 'GET',
    headers: buildAuthHeaders(sessionToken, simulateOutage),
  });
  return parseApiJson<GraphResponseDto>(response);
}

export async function fetchAuthorizedRoomDetails(
  sessionToken: string,
  roomId: string
): Promise<RoomDetailDto> {
  const response = await fetch(`/api/v1/graph/dormitory/rooms/${encodeURIComponent(roomId)}`, {
    method: 'GET',
    headers: buildAuthHeaders(sessionToken),
  });
  return parseApiJson<RoomDetailDto>(response);
}

export async function fetchAuthorizedStudentDetails(
  sessionToken: string,
  studentId: string
): Promise<StudentPublicDetailDto> {
  const response = await fetch(
    `/api/v1/graph/dormitory/students/${encodeURIComponent(studentId)}`,
    {
      method: 'GET',
      headers: buildAuthHeaders(sessionToken),
    }
  );
  return parseApiJson<StudentPublicDetailDto>(response);
}

export async function fetchAvailableSessions(): Promise<SessionAccountOption[]> {
  const response = await fetch('/api/v1/auth/sessions', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return parseApiJson<SessionAccountOption[]>(response);
}

export interface SecurityProbeResult {
  endpoint: string;
  method: string;
  httpStatus: number;
  ok: boolean;
  responseBody: unknown;
}

export async function runSecurityProbe(params: {
  sessionToken?: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'DELETE';
}): Promise<SecurityProbeResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (params.sessionToken) {
    headers.Authorization = `Bearer ${params.sessionToken}`;
  }

  const response = await fetch(params.endpoint, {
    method: params.method ?? 'GET',
    headers,
    body: params.method === 'POST' ? JSON.stringify({ label: 'تلاش تغییر غیرمجاز' }) : undefined,
  });

  let responseBody: unknown = null;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = { message: 'پاسخ غیر JSON' };
  }

  return {
    endpoint: params.endpoint,
    method: params.method ?? 'GET',
    httpStatus: response.status,
    ok: response.ok,
    responseBody,
  };
}
