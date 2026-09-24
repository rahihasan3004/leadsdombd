CREATE TABLE "Organization" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"(slug);
CREATE INDEX "Organization_slug_idx" ON "Organization"(slug);

CREATE TABLE "User" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL,
    emailVerified TIMESTAMP(3),
    image TEXT,
    passwordHash TEXT,
    role TEXT NOT NULL DEFAULT 'USER',
    walletBalance DECIMAL(12,2) NOT NULL DEFAULT 0,
    tokenVersion INTEGER NOT NULL DEFAULT 0,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    organizationId TEXT NOT NULL
);

CREATE UNIQUE INDEX "User_email_key" ON "User"(email);
CREATE INDEX "User_organizationId_idx" ON "User"(organizationId);
CREATE INDEX "User_email_idx" ON "User"(email);

CREATE TABLE "Account" (
    id TEXT NOT NULL PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE ("provider","providerAccountId")
);

CREATE INDEX "Account_userId_idx" ON "Account"(userId);

CREATE TABLE "Session" (
    id TEXT NOT NULL PRIMARY KEY,
    sessionToken TEXT NOT NULL,
    userId TEXT NOT NULL,
    expires TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"(sessionToken);
CREATE INDEX "Session_userId_idx" ON "Session"(userId);

CREATE TABLE "VerificationToken" (
    id TEXT NOT NULL PRIMARY KEY,
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TIMESTAMP(3) NOT NULL,
    failedAttempts INTEGER NOT NULL DEFAULT 0,
    lockedUntil TIMESTAMP(3),
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"(token);
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier","token");
CREATE INDEX "VerificationToken_identifier_idx" ON "VerificationToken"(identifier);

CREATE TABLE "Subscription" (
    id TEXT NOT NULL PRIMARY KEY,
    userId TEXT NOT NULL,
    organizationId TEXT NOT NULL,
    stripeSubscriptionId TEXT,
    stripeCustomerId TEXT,
    stripePriceId TEXT,
    tier TEXT NOT NULL DEFAULT 'FREE',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    quantity INTEGER NOT NULL DEFAULT 1,
    currentPeriodStart TIMESTAMP(3),
    currentPeriodEnd TIMESTAMP(3),
    cancelAtPeriodEnd BOOLEAN NOT NULL DEFAULT false,
    canceledAt TIMESTAMP(3),
    trialEndsAt TIMESTAMP(3),
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"(stripeSubscriptionId);
CREATE INDEX "Subscription_userId_idx" ON "Subscription"(userId);
CREATE INDEX "Subscription_organizationId_idx" ON "Subscription"(organizationId);
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"(stripeCustomerId);

CREATE TABLE "ApiKey" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    hashedKey TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    lastUsedAt TIMESTAMP(3),
    expiresAt TIMESTAMP(3),
    isActive BOOLEAN NOT NULL DEFAULT true,
    userId TEXT NOT NULL,
    organizationId TEXT NOT NULL,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ApiKey_hashedKey_key" ON "ApiKey"(hashedKey);
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"(userId);
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"(organizationId);

CREATE TABLE "SearchHistory" (
    id TEXT NOT NULL PRIMARY KEY,
    userId TEXT NOT NULL,
    organizationId TEXT NOT NULL,
    query JSONB NOT NULL,
    resultCount INTEGER NOT NULL DEFAULT 0,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SearchHistory_userId_idx" ON "SearchHistory"(userId);
CREATE INDEX "SearchHistory_organizationId_idx" ON "SearchHistory"(organizationId);
CREATE INDEX "SearchHistory_createdAt_idx" ON "SearchHistory"(createdAt);

CREATE TABLE "SavedList" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    query JSONB NOT NULL,
    agentCount INTEGER NOT NULL DEFAULT 0,
    userId TEXT NOT NULL,
    organizationId TEXT NOT NULL,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SavedList_userId_idx" ON "SavedList"(userId);
CREATE INDEX "SavedList_organizationId_idx" ON "SavedList"(organizationId);

CREATE TABLE "LeadExport" (
    id TEXT NOT NULL PRIMARY KEY,
    userId TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'CSV',
    agentCount INTEGER NOT NULL,
    fileUrl TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    searchQuery JSONB NOT NULL,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP(3)
);

CREATE INDEX "LeadExport_userId_idx" ON "LeadExport"(userId);
CREATE INDEX "LeadExport_status_idx" ON "LeadExport"(status);

CREATE TABLE "Agent" (
    id TEXT NOT NULL PRIMARY KEY,
    fullName TEXT NOT NULL,
    firstName TEXT,
    lastName TEXT,
    email TEXT,
    phone TEXT,
    officePhone TEXT,
    licenseNumber TEXT,
    licenseState TEXT,
    licenseStatus TEXT NOT NULL DEFAULT 'ACTIVE',
    licenseExpiry TIMESTAMP(3),
    nmlsId TEXT,
    brokerageName TEXT,
    brokerageAddress TEXT,
    city TEXT,
    state TEXT,
    zipCode TEXT,
    county TEXT,
    marketArea TEXT,
    propertyTypes TEXT[] NOT NULL,
    transactionCount INTEGER NOT NULL DEFAULT 0,
    totalVolume DECIMAL(12,2) NOT NULL DEFAULT 0,
    averagePrice DECIMAL(12,2) NOT NULL DEFAULT 0,
    yearsExperience INTEGER NOT NULL DEFAULT 0,
    specializations TEXT[] NOT NULL,
    bio TEXT,
    photoUrl TEXT,
    websiteUrl TEXT,
    socialProfiles JSONB,
    dataSource TEXT,
    lastVerifiedAt TIMESTAMP(3),
    verificationScore INTEGER NOT NULL DEFAULT 0,
    isVerified BOOLEAN NOT NULL DEFAULT false,
    timezone TEXT,
    category TEXT,
    googleMainCategory TEXT,
    googleSubcategories TEXT,
    rating REAL,
    reviewCount INTEGER,
    scrapedAt TIMESTAMP(3),
    emailStatus TEXT,
    isDeliverable BOOLEAN NOT NULL DEFAULT true,
    googlePlaceId TEXT,
    googleMapsLink TEXT,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Agent_googlePlaceId_key" ON "Agent"(googlePlaceId);
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"(email);
CREATE INDEX "Agent_state_idx" ON "Agent"(state);
CREATE INDEX "Agent_licenseState_licenseNumber_idx" ON "Agent"(licenseState, licenseNumber);
CREATE INDEX "Agent_city_state_idx" ON "Agent"(city, state);
CREATE INDEX "Agent_brokerageName_idx" ON "Agent"(brokerageName);
CREATE INDEX "Agent_isVerified_idx" ON "Agent"(isVerified);
CREATE INDEX "Agent_verificationScore_idx" ON "Agent"(verificationScore);
CREATE INDEX "Agent_fullName_idx" ON "Agent"(fullName);
CREATE INDEX "Agent_googlePlaceId_idx" ON "Agent"(googlePlaceId);
CREATE INDEX "Agent_email_idx" ON "Agent"(email);
CREATE INDEX "Agent_isDeliverable_idx" ON "Agent"(isDeliverable);
CREATE INDEX "Agent_dataSource_idx" ON "Agent"(dataSource);
CREATE INDEX "Agent_category_idx" ON "Agent"(category);
CREATE INDEX "Agent_state_category_idx" ON "Agent"(state, category);

CREATE TABLE "AgentActivity" (
    id TEXT NOT NULL PRIMARY KEY,
    agentId TEXT NOT NULL,
    type TEXT NOT NULL,
    details JSONB,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AgentActivity_agentId_createdAt_idx" ON "AgentActivity"(agentId, createdAt);

CREATE TABLE "AuditLog" (
    id TEXT NOT NULL PRIMARY KEY,
    userId TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resourceId TEXT,
    details JSONB,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"(userId);
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"(action);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"(createdAt);

CREATE TABLE "WebhookEvent" (
    id TEXT NOT NULL PRIMARY KEY,
    eventId TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'stripe',
    processedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    payload JSONB
);

CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"(eventId);
CREATE INDEX "WebhookEvent_eventId_idx" ON "WebhookEvent"(eventId);
CREATE INDEX "WebhookEvent_provider_processedAt_idx" ON "WebhookEvent"(provider, processedAt);

CREATE TABLE "LeadPurchase" (
    id TEXT NOT NULL PRIMARY KEY,
    referenceId TEXT NOT NULL,
    userId TEXT NOT NULL,
    state TEXT,
    unlockedStates TEXT[] NOT NULL,
    amountPaid DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    stripeSessionId TEXT,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "LeadPurchase_referenceId_key" ON "LeadPurchase"(referenceId);
CREATE INDEX "LeadPurchase_userId_idx" ON "LeadPurchase"(userId);
CREATE INDEX "LeadPurchase_userId_createdAt_idx" ON "LeadPurchase"(userId, createdAt);

CREATE TABLE "WalletTransaction" (
    id TEXT NOT NULL PRIMARY KEY,
    referenceId TEXT NOT NULL,
    userId TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'RECHARGE',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    balanceAfter DECIMAL(12,2),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    stripeSessionId TEXT,
    metadata JSONB,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "WalletTransaction_referenceId_key" ON "WalletTransaction"(referenceId);
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"(userId);
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"(createdAt);
