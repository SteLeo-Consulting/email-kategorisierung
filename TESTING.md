# Test Plan

## 1. Unit Tests

### Classification Tests

```typescript
// __tests__/classification/rule-classifier.test.ts
import { RuleBasedClassifier } from '@/lib/classification/rule-classifier';

describe('RuleBasedClassifier', () => {
  const mockRules = [
    {
      id: '1',
      categoryId: 'cat-1',
      categoryCode: 'INVOICE',
      name: 'Rechnung Keyword',
      type: 'KEYWORD' as const,
      field: 'SUBJECT' as const,
      pattern: 'rechnung',
      caseSensitive: false,
      priority: 100,
      confidence: 0.90,
    },
    {
      id: '2',
      categoryId: 'cat-2',
      categoryCode: 'NEWSLETTER',
      name: 'Newsletter Regex',
      type: 'REGEX' as const,
      field: 'BODY' as const,
      pattern: '(newsletter|abmelden)',
      caseSensitive: false,
      priority: 80,
      confidence: 0.85,
    },
  ];

  let classifier: RuleBasedClassifier;

  beforeEach(() => {
    classifier = new RuleBasedClassifier('user-1');
    // Mock loadRules
    (classifier as any).rules = mockRules;
  });

  test('matches keyword in subject', () => {
    const result = classifier.classify({
      id: 'msg-1',
      provider: 'GMAIL',
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      subject: 'Ihre Rechnung Nr. 12345',
      date: new Date(),
    });

    expect(result).not.toBeNull();
    expect(result?.category).toBe('INVOICE');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test('matches regex in body', () => {
    const result = classifier.classify({
      id: 'msg-2',
      provider: 'GMAIL',
      from: 'newsletter@company.com',
      to: ['user@example.com'],
      subject: 'Wochenupdate',
      body: 'Hier sind die News. Zum Abmelden klicken Sie hier.',
      date: new Date(),
    });

    expect(result).not.toBeNull();
    expect(result?.category).toBe('NEWSLETTER');
  });

  test('returns null for no match', () => {
    const result = classifier.classify({
      id: 'msg-3',
      provider: 'GMAIL',
      from: 'friend@example.com',
      to: ['me@example.com'],
      subject: 'Hallo, wie gehts?',
      date: new Date(),
    });

    expect(result).toBeNull();
  });

  test('respects priority order', () => {
    // Add conflicting rule with lower priority
    (classifier as any).rules.push({
      id: '3',
      categoryId: 'cat-3',
      categoryCode: 'TODO',
      name: 'Catch All',
      type: 'KEYWORD' as const,
      field: 'ANY' as const,
      pattern: 'rechnung',
      caseSensitive: false,
      priority: 10, // Lower priority
      confidence: 0.70,
    });

    const result = classifier.classify({
      id: 'msg-4',
      provider: 'GMAIL',
      from: 'billing@company.com',
      to: ['me@example.com'],
      subject: 'Rechnung beigefuegt',
      date: new Date(),
    });

    // Should match INVOICE (higher priority), not TODO
    expect(result?.category).toBe('INVOICE');
  });

  test('handles case sensitivity', () => {
    (classifier as any).rules = [
      {
        id: '4',
        categoryId: 'cat-1',
        categoryCode: 'INVOICE',
        name: 'Case Sensitive',
        type: 'KEYWORD' as const,
        field: 'SUBJECT' as const,
        pattern: 'RECHNUNG',
        caseSensitive: true,
        priority: 100,
        confidence: 0.90,
      },
    ];

    const lowerCase = classifier.classify({
      id: 'msg-5',
      provider: 'GMAIL',
      from: 'test@test.com',
      to: ['me@test.com'],
      subject: 'rechnung hier', // lowercase
      date: new Date(),
    });

    const upperCase = classifier.classify({
      id: 'msg-6',
      provider: 'GMAIL',
      from: 'test@test.com',
      to: ['me@test.com'],
      subject: 'RECHNUNG hier', // uppercase
      date: new Date(),
    });

    expect(lowerCase).toBeNull(); // No match (case sensitive)
    expect(upperCase?.category).toBe('INVOICE'); // Match
  });
});
```

### Crypto Tests

```typescript
// __tests__/crypto/encryption.test.ts
import { encrypt, decrypt, generateEncryptionKey, isEncrypted } from '@email-cat/shared';

describe('Encryption', () => {
  beforeAll(() => {
    // Set test encryption key
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
  });

  test('encrypts and decrypts correctly', () => {
    const original = 'super-secret-token-12345';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);

    expect(encrypted).not.toBe(original);
    expect(decrypted).toBe(original);
  });

  test('produces different ciphertext for same input', () => {
    const original = 'test-value';
    const encrypted1 = encrypt(original);
    const encrypted2 = encrypt(original);

    // Due to random IV and salt, ciphertext should differ
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to same value
    expect(decrypt(encrypted1)).toBe(original);
    expect(decrypt(encrypted2)).toBe(original);
  });

  test('isEncrypted detects encrypted data', () => {
    const encrypted = encrypt('test');
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted('not-encrypted')).toBe(false);
  });

  test('handles special characters', () => {
    const special = 'password with !@#$%^&*() and umlaeute';
    const encrypted = encrypt(special);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(special);
  });

  test('throws on invalid encryption key', () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'invalid';

    expect(() => encrypt('test')).toThrow();

    process.env.ENCRYPTION_KEY = originalKey;
  });
});
```

## 2. Integration Tests

### Provider Tests

```typescript
// __tests__/providers/gmail.test.ts
import { GmailProvider } from '@/lib/providers/gmail';

// Use test account or mock
describe('GmailProvider', () => {
  let provider: GmailProvider;

  beforeAll(() => {
    // Skip if no test credentials
    if (!process.env.TEST_GMAIL_ACCESS_TOKEN) {
      console.log('Skipping Gmail tests - no test credentials');
      return;
    }

    provider = new GmailProvider({
      accessToken: process.env.TEST_GMAIL_ACCESS_TOKEN!,
      refreshToken: process.env.TEST_GMAIL_REFRESH_TOKEN,
    });
  });

  test('fetches messages', async () => {
    if (!provider) return;

    const result = await provider.fetchMessages({
      maxResults: 5,
    });

    expect(result.messages).toBeInstanceOf(Array);
    expect(result.messages.length).toBeLessThanOrEqual(5);

    if (result.messages.length > 0) {
      const msg = result.messages[0];
      expect(msg.id).toBeDefined();
      expect(msg.from).toBeDefined();
      expect(msg.subject).toBeDefined();
    }
  });

  test('gets labels', async () => {
    if (!provider) return;

    const labels = await provider.getLabels();

    expect(labels).toBeInstanceOf(Array);
    expect(labels.length).toBeGreaterThan(0);

    // Should include INBOX
    const inbox = labels.find(l => l.name === 'INBOX');
    expect(inbox).toBeDefined();
  });

  test('creates and applies label', async () => {
    if (!provider) return;

    // Create test label
    const testLabelName = `EmailCat-Test-${Date.now()}`;
    const label = await provider.createLabel(testLabelName);

    expect(label.id).toBeDefined();
    expect(label.name).toBe(testLabelName);

    // Cleanup would require deleting the label
  });

  test('tests connection', async () => {
    if (!provider) return;

    const isValid = await provider.testConnection();
    expect(isValid).toBe(true);
  });

  afterAll(async () => {
    if (provider) {
      await provider.disconnect();
    }
  });
});
```

### API Route Tests

```typescript
// __tests__/api/connections.test.ts
import { createMocks } from 'node-mocks-http';
import { GET, POST } from '@/app/api/connections/route';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    connection: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    iMAPCredential: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

describe('Connections API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET returns connections for authenticated user', async () => {
    const { getServerSession } = require('next-auth');
    const { prisma } = require('@/lib/prisma');

    getServerSession.mockResolvedValue({
      user: { email: 'test@example.com' },
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });

    prisma.connection.findMany.mockResolvedValue([
      {
        id: 'conn-1',
        provider: 'GMAIL',
        email: 'test@gmail.com',
        status: 'ACTIVE',
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.connections).toHaveLength(1);
  });

  test('GET returns 401 for unauthenticated user', async () => {
    const { getServerSession } = require('next-auth');
    getServerSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  test('POST creates IMAP connection', async () => {
    const { getServerSession } = require('next-auth');
    const { prisma } = require('@/lib/prisma');

    getServerSession.mockResolvedValue({
      user: { email: 'test@example.com' },
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
    });

    prisma.connection.create.mockResolvedValue({
      id: 'conn-new',
      provider: 'IMAP',
      email: 'test@strato.de',
      status: 'ACTIVE',
    });

    const { req } = createMocks({
      method: 'POST',
      body: {
        host: 'imap.strato.de',
        port: 993,
        secure: true,
        username: 'test@strato.de',
        password: 'testpassword',
      },
    });

    // Create proper Request object
    const request = new Request('http://localhost/api/connections', {
      method: 'POST',
      body: JSON.stringify(req.body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

## 3. E2E Tests (Manual Checklist)

### OAuth Flow

- [ ] Gmail: Klicke "Mit Gmail anmelden"
- [ ] Gmail: Consent Screen erscheint
- [ ] Gmail: Nach Zustimmung -> Dashboard
- [ ] Gmail: Verbindung erscheint in Liste
- [ ] Outlook: Klicke "Mit Microsoft anmelden"
- [ ] Outlook: Microsoft Login erscheint
- [ ] Outlook: Nach Zustimmung -> Dashboard
- [ ] Outlook: Verbindung erscheint in Liste

### IMAP Flow

- [ ] IMAP: Klicke "IMAP konfigurieren"
- [ ] IMAP: Dialog oeffnet sich
- [ ] IMAP: Strato-Defaults vorausgefuellt
- [ ] IMAP: Eingabe von Username/Passwort
- [ ] IMAP: Klicke "Verbinden"
- [ ] IMAP: Verbindung erscheint in Liste

### Processing Flow

- [ ] Verbindung: Klicke "Test" -> Erfolgsmeldung
- [ ] Verbindung: Klicke "Play" -> Verarbeitung startet
- [ ] Dashboard: "Heute verarbeitet" zaehlt hoch
- [ ] Review: Unsichere E-Mails erscheinen
- [ ] Review: "Genehmigen" entfernt aus Liste
- [ ] Review: "Aendern" setzt neue Kategorie
- [ ] Audit: Aktionen werden geloggt

### Label/Category Check

- [ ] Gmail: Neues Label "EmailCat/..." erscheint
- [ ] Gmail: E-Mail hat Label
- [ ] Outlook: Kategorie erscheint
- [ ] Outlook: E-Mail hat Kategorie

## 4. Testdaten

### Test-E-Mails

Sende dir selbst Test-E-Mails:

**Invoice Test:**
```
Betreff: Ihre Rechnung Nr. 2024-001
Von: billing@testcompany.com
Inhalt: Anbei finden Sie Ihre Rechnung...
```

**Newsletter Test:**
```
Betreff: Wochenupdate KW 3
Von: newsletter@testcompany.com
Inhalt: ... Um sich abzumelden klicken Sie hier ...
```

**Support Test:**
```
Betreff: [Ticket #12345] Ihre Anfrage
Von: support@testcompany.com
Inhalt: Vielen Dank fuer Ihre Anfrage...
```

### Test-Regeln

Erstelle Test-Regeln in der UI:

1. KEYWORD: "test" in ANY -> TODO
2. REGEX: "urgent|dringend" in SUBJECT -> TODO
3. SENDER: "@testdomain.com" -> CUSTOMER

## 5. Test-Accounts

### Gmail Test Account

1. Erstelle neuen Google Account
2. Fuege als Test User in OAuth Consent hinzu
3. Generiere Test-E-Mails

### Microsoft Test Account

1. Nutze persoenlichen Microsoft Account
2. Oder: Azure Dev Account erstellen
3. Generiere Test-E-Mails

### Strato Test

1. Nutze echten Strato-Account (oder Subdomain)
2. Erstelle App-Passwort
3. Generiere Test-E-Mails

## 6. Performance Tests

### Concurrent Connections

```bash
# Teste 5 gleichzeitige Verarbeitungen
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/connections/conn-$i/process &
done
wait
```

### Large Rule Set

1. Erstelle 100+ Regeln
2. Verarbeite E-Mails
3. Messe Antwortzeit

### Database Load

```sql
-- Fuege Test-Daten ein
INSERT INTO processed_messages (connection_id, message_id, confidence, ...)
SELECT 'conn-1', 'msg-' || generate_series, 0.8, ...
FROM generate_series(1, 10000);

-- Pruefe Query-Performance
EXPLAIN ANALYZE
SELECT * FROM processed_messages
WHERE connection_id = 'conn-1'
ORDER BY created_at DESC
LIMIT 50;
```
