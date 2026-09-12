export interface ProviderCredentials {
  api_url?: string | null;
  api_key?: string | null;
  instance_id?: string | null;
  session_name?: string | null;
  phone_number_id?: string | null;
  extra?: Record<string, any>;
  timeout_ms?: number;
}

export interface SendMessageInput {
  to: string; // E.164 phone
  body: string;
  language?: string;
  media_url?: string | null;
  meta?: Record<string, any>;
}

export interface SendMessageResult {
  ok: boolean;
  provider_message_id?: string | null;
  http_status?: number;
  duration_ms?: number;
  request_snapshot?: any;
  response_snapshot?: any;
  error_message?: string;
  error_code?: string;
  retryable?: boolean;
}

export interface HealthCheckResult {
  ok: boolean;
  session_status?: string;
  instance_status?: string;
  avg_response_ms?: number;
  error_message?: string;
}

export interface NotificationProvider {
  code: string;
  send(creds: ProviderCredentials, input: SendMessageInput): Promise<SendMessageResult>;
  checkHealth?(creds: ProviderCredentials): Promise<HealthCheckResult>;
}
