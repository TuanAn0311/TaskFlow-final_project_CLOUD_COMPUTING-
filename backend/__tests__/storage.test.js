'use strict';

const storage = require('../src/services/supabaseStorage');

describe('Supabase file storage helpers', () => {
  test('requires complete HTTPS storage configuration', () => {
    expect(() => storage.getStorageConfig({})).toThrow(/not configured/i);
    expect(() => storage.getStorageConfig({
      SUPABASE_URL: 'http://files.example.com',
      SUPABASE_SERVICE_ROLE_KEY: 'server-secret',
      SUPABASE_STORAGE_BUCKET: 'taskflow-files',
    })).toThrow(/HTTPS/i);
    expect(storage.getStorageConfig({
      SUPABASE_URL: 'https://files.example.com/',
      SUPABASE_SERVICE_ROLE_KEY: 'server-secret',
      SUPABASE_STORAGE_BUCKET: 'taskflow-files',
    })).toEqual({
      baseUrl: 'https://files.example.com',
      serviceKey: 'server-secret',
      bucket: 'taskflow-files',
    });
  });

  test('accepts only supported file extensions and matching MIME types', () => {
    expect(storage.validateFile({
      originalname: 'specification.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf'),
    })).toMatchObject({
      originalFilename: 'specification.pdf',
      contentType: 'application/pdf',
      fileSize: 3,
    });
    expect(() => storage.validateFile({
      originalname: 'script.html',
      mimetype: 'text/html',
      buffer: Buffer.from('<script>'),
    })).toThrow(/unsupported file type/i);
    expect(() => storage.validateFile({
      originalname: 'image.png',
      mimetype: 'application/pdf',
      buffer: Buffer.from('content'),
    })).toThrow(/unsupported file type/i);
    expect(() => storage.validateFile({
      originalname: 'large.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.alloc(storage.MAX_FILE_SIZE + 1),
    })).toThrow(/10 MB or smaller/i);
  });

  test('creates opaque per-upload storage paths without using the original filename', () => {
    const first = storage.createStoragePath(42, null, 'my file.pdf');
    const second = storage.createStoragePath(42, null, 'my file.pdf');
    expect(first).toMatch(/^42\/documents\/[0-9a-f-]+\.pdf$/i);
    expect(first).not.toBe(second);
    expect(first).not.toContain('my file');
    expect(storage.createStoragePath(42, 7, 'report.docx')).toMatch(/^42\/reports\/7\/[0-9a-f-]+\.docx$/i);
  });

  test('creates short-lived signed URLs without exposing storage credentials', async () => {
    const originalFetch = global.fetch;
    const originalEnvironment = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    };
    process.env.SUPABASE_URL = 'https://files.example.com';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-secret';
    process.env.SUPABASE_STORAGE_BUCKET = 'taskflow-files';
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      signedURL: '/object/sign/taskflow-files/42/documents/file.pdf?token=short-lived',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    try {
      await expect(storage.createSignedUrl('42/documents/file.pdf', false)).resolves.toBe(
        'https://files.example.com/storage/v1/object/sign/taskflow-files/42/documents/file.pdf?token=short-lived'
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://files.example.com/storage/v1/object/sign/taskflow-files/42/documents/file.pdf',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            apikey: 'server-secret',
            Authorization: 'Bearer server-secret',
          }),
        })
      );
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ expiresIn: 120, download: false });
    } finally {
      global.fetch = originalFetch;
      for (const [key, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
