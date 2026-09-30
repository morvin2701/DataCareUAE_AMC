-- The link to the customers' ERP servers: each server posts a heartbeat; DcAMC pushes licences back.
IF OBJECT_ID('AMC_SERVER') IS NULL
CREATE TABLE AMC_SERVER (
  SERVER_ID       INT IDENTITY(1,1) PRIMARY KEY,
  SERVER_CODE     VARCHAR(20)   NOT NULL UNIQUE,      -- SRV0001 — the part of the link key before the dot
  NAME            NVARCHAR(150) NOT NULL,
  LINK_KEY_HASH   VARCHAR(100)  NULL,                 -- sha256 of the secret: verifies an incoming heartbeat
  LINK_KEY_ENC    VARCHAR(500)  NULL,                 -- AES-256-GCM of the same secret: signs the licence push to that server
  BASE_URL        VARCHAR(300)  NULL,                 -- where that ERP answers, e.g. https://erp.shop.ae
  IP              VARCHAR(64)   NULL,
  HOSTNAME        NVARCHAR(150) NULL,
  APP_VERSION     VARCHAR(60)   NULL,
  PENDING_SCRIPTS INT           NOT NULL DEFAULT 0,
  LAST_HEARTBEAT  DATETIME2     NULL,
  ACTIVE          BIT           NOT NULL DEFAULT 1,
  ENTRY_DATE      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  EDIT_DATE       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
-- one row per shop per server, written only by heartbeats (plus our own NOTES / INSTALLER / ACTIVE)
IF OBJECT_ID('AMC_CUSTOMER') IS NULL
CREATE TABLE AMC_CUSTOMER (
  CUST_ID       INT IDENTITY(1,1) PRIMARY KEY,
  SERVER_ID     INT           NOT NULL,
  SHOP_CODE     VARCHAR(20)   NOT NULL,
  SHOP_NAME     NVARCHAR(150) NOT NULL,
  HDD           VARCHAR(20)   NULL,                   -- DC0001WBST
  PLAN_CODE     VARCHAR(20)   NULL,                   -- BASIC | PRO | ADVANCE | ENTERPRISE
  STATUS        VARCHAR(10)   NULL,                   -- ACTIVE | SUSPEND (as the ERP says)
  TILLS         INT           NOT NULL DEFAULT 0,
  LIC_START     DATE          NULL,
  LIC_END       DATE          NULL,
  CONTACT_NAME  NVARCHAR(100) NULL,
  MOBILE_NO     VARCHAR(20)   NULL,
  EMAIL_ID      NVARCHAR(150) NULL,
  EMIRATE_CODE  VARCHAR(3)    NULL,
  LAST_LOGIN    DATETIME2     NULL,
  USERS         INT           NULL,
  ENTRIES_TODAY INT           NULL,
  ENTRIES_30D   INT           NULL,
  INSTALLER     VARCHAR(10)   NULL,
  NOTES         NVARCHAR(2000) NULL,
  ACTIVE        BIT           NOT NULL DEFAULT 1,
  LAST_SEEN     DATETIME2     NULL,                   -- the heartbeat that last carried this shop
  ENTRY_DATE    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  EDIT_DATE     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UX_AMC_CUSTOMER UNIQUE (SERVER_ID, SHOP_CODE)
);
GO
-- licence pushes that could not reach the server yet; retried on that server's next heartbeat
IF OBJECT_ID('AMC_PUSH_QUEUE') IS NULL
CREATE TABLE AMC_PUSH_QUEUE (
  PUSH_ID     INT IDENTITY(1,1) PRIMARY KEY,
  SERVER_ID   INT NOT NULL,
  CUST_ID     INT NOT NULL,
  CONTRACT_ID INT NULL,
  PAYLOAD     NVARCHAR(MAX) NOT NULL,                 -- { shopCode, endDate, tills?, plan?, status? }
  STATUS      VARCHAR(10) NOT NULL DEFAULT 'PENDING', -- PENDING | DONE | FAILED
  TRIES       INT NOT NULL DEFAULT 0,
  LAST_ERROR  NVARCHAR(500) NULL,
  LAST_TRY    DATETIME2 NULL,
  DONE_AT     DATETIME2 NULL,
  ENTRY_DATE  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
