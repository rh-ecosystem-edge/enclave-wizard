import type { APIRequestContext } from "@playwright/test";

export interface ProvisionResponse {
  id: string;
  state: "accepted" | "rejected";
  message: string;
}

export interface ProvisionStatus {
  state: "pending" | "running" | "completed" | "failed";
  progress: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{ field: string; message: string }>;
}

export interface ConfigPreview {
  global: string;
  cloudInfra: string;
  certificates: string;
}

export interface LoginResponse {
  token: string;
  mustChangePassword: boolean;
}

export interface ChangePasswordResponse {
  token: string;
}

export class WizardApi {
  private token = "";

  constructor(
    private request: APIRequestContext,
    private baseUrl: string,
  ) {}

  setToken(token: string) {
    this.token = token;
  }

  private authHeaders(): Record<string, string> {
    if (!this.token) return {};
    return { Authorization: `Bearer ${this.token}` };
  }

  async login(password: string): Promise<LoginResponse> {
    const res = await this.request.post(`${this.baseUrl}/api/v1/auth/login`, {
      data: { username: "admin", password },
    });
    if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
    const body: LoginResponse = await res.json();
    this.token = body.token;
    return body;
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResponse> {
    const res = await this.request.post(
      `${this.baseUrl}/api/v1/auth/password`,
      {
        data: { currentPassword, newPassword },
        headers: this.authHeaders(),
      },
    );
    if (!res.ok()) throw new Error(`changePassword failed: ${res.status()}`);
    const body: ChangePasswordResponse = await res.json();
    this.token = body.token;
    return body;
  }

  async writeConfig(config: Record<string, unknown>): Promise<void> {
    const res = await this.request.put(`${this.baseUrl}/api/v1/config`, {
      data: config,
      headers: this.authHeaders(),
    });
    if (!res.ok()) throw new Error(`writeConfig failed: ${res.status()}`);
  }

  async getConfig(): Promise<Record<string, unknown>> {
    const res = await this.request.get(`${this.baseUrl}/api/v1/config`, {
      headers: this.authHeaders(),
    });
    if (!res.ok()) throw new Error(`getConfig failed: ${res.status()}`);
    return res.json();
  }

  async validateConfig(
    config: Record<string, unknown>,
  ): Promise<ValidationResult> {
    const res = await this.request.post(
      `${this.baseUrl}/api/v1/config/validate`,
      { data: config, headers: this.authHeaders() },
    );
    if (!res.ok()) throw new Error(`validateConfig failed: ${res.status()}`);
    return res.json();
  }

  async getDefaults(): Promise<Record<string, unknown>> {
    const res = await this.request.get(`${this.baseUrl}/api/v1/defaults`, {
      headers: this.authHeaders(),
    });
    if (!res.ok()) throw new Error(`getDefaults failed: ${res.status()}`);
    return res.json();
  }

  // --- Provision helpers ---
  // These two methods encapsulate the provision API contract.
  // Currently they return fake responses because the API is not implemented.
  // When POST /api/v1/provision and GET /api/v1/provision/status land,
  // replace ONLY these two methods with real API calls.

  async triggerProvision(
    _config: Record<string, unknown>,
  ): Promise<ProvisionResponse> {
    // TODO: Replace with real API call:
    // const res = await this.request.post(`${this.baseUrl}/api/v1/provision`, { data: config });
    // return this.parseProvisionResponse(res);
    return {
      id: "fake-provision-001",
      state: "accepted",
      message: "Provisioning accepted (simulated)",
    };
  }

  async getProvisionStatus(_id: string): Promise<ProvisionStatus> {
    // TODO: Replace with real API call:
    // const res = await this.request.get(`${this.baseUrl}/api/v1/provision/status`);
    // return this.parseProvisionStatus(res);
    return {
      state: "completed",
      progress: 100,
      message: "Provisioning complete (simulated)",
    };
  }

  // --- Response parsers ---
  // Encapsulated so the test code never touches raw responses.
  // When the API shape changes, update these — tests stay the same.

  // private async parseProvisionResponse(res: APIResponse): Promise<ProvisionResponse> {
  //   const body = await res.json();
  //   return {
  //     id: body.id,
  //     state: body.state,
  //     message: body.message ?? "",
  //   };
  // }

  // private async parseProvisionStatus(res: APIResponse): Promise<ProvisionStatus> {
  //   const body = await res.json();
  //   return {
  //     state: body.state,
  //     progress: body.progress ?? 0,
  //     message: body.message ?? "",
  //   };
  // }
}
