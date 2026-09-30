-- Reminder rules (what, how many days before, on which channel) and the log of what went out.
IF OBJECT_ID('AMC_REMINDER_RULE') IS NULL
CREATE TABLE AMC_REMINDER_RULE (
  RULE_ID     INT IDENTITY(1,1) PRIMARY KEY,
  KIND        VARCHAR(20)   NOT NULL,                 -- LIC_EXPIRY | AMC_EXPIRY | PAY_OVERDUE | TICKET_OVERDUE
  DAYS        INT           NOT NULL DEFAULT 0,       -- days before expiry (LIC / AMC), days after due (PAY), hours over SLA (TICKET)
  CHANNELS    VARCHAR(20)   NOT NULL DEFAULT 'WA',    -- WA,EMAIL
  TEMPLATE    NVARCHAR(2000) NULL,                    -- {shop} {contact} {date} {days} {amount} {no}
  TO_TEAM     BIT           NOT NULL DEFAULT 0,       -- also tell the DataCare team (owner's mobile / e-mail)
  ACTIVE      BIT           NOT NULL DEFAULT 1,
  EDIT_DATE   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('AMC_REMINDER_LOG') IS NULL
CREATE TABLE AMC_REMINDER_LOG (
  LOG_ID     BIGINT IDENTITY(1,1) PRIMARY KEY,
  RULE_ID    INT           NULL,
  KIND       VARCHAR(20)   NOT NULL,
  CUST_ID    INT           NULL,
  REF_KEY    VARCHAR(60)   NULL,                      -- what it was about (contract no, invoice no, ticket no, licence end)
  CHANNEL    VARCHAR(10)   NOT NULL,                  -- WA | EMAIL
  SENT_TO    NVARCHAR(150) NULL,
  MESSAGE    NVARCHAR(2000) NULL,
  OK         BIT           NOT NULL DEFAULT 0,
  RESULT     NVARCHAR(1000) NULL,
  SENT_AT    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  USER_ID    INT           NULL                       -- null = the scheduler
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AMC_REMINDER_LOG_REF') CREATE INDEX IX_AMC_REMINDER_LOG_REF ON AMC_REMINDER_LOG (KIND, CUST_ID, REF_KEY, CHANNEL);
GO
-- the four standard rules, once
IF NOT EXISTS (SELECT 1 FROM AMC_REMINDER_RULE)
INSERT INTO AMC_REMINDER_RULE (KIND, DAYS, CHANNELS, TEMPLATE, TO_TEAM) VALUES
  ('LIC_EXPIRY', 30, 'WA,EMAIL', N'Dear {contact}, the DataCare ERP licence of {shop} expires on {date} ({days} days). Please renew in time to avoid interruption. — DataCare Softech FZCO', 0),
  ('LIC_EXPIRY', 15, 'WA,EMAIL', N'Dear {contact}, the DataCare ERP licence of {shop} expires on {date} ({days} days). Please renew in time to avoid interruption. — DataCare Softech FZCO', 0),
  ('LIC_EXPIRY', 7,  'WA,EMAIL', N'Dear {contact}, the DataCare ERP licence of {shop} expires on {date} ({days} days). Please renew now. — DataCare Softech FZCO', 1),
  ('LIC_EXPIRY', 0,  'WA,EMAIL', N'Dear {contact}, the DataCare ERP licence of {shop} expires today ({date}). Please contact DataCare to renew. — DataCare Softech FZCO', 1),
  ('AMC_EXPIRY', 30, 'WA,EMAIL', N'Dear {contact}, the annual maintenance contract {no} of {shop} ends on {date}. Please contact DataCare to renew. — DataCare Softech FZCO', 1),
  ('PAY_OVERDUE', 7, 'WA,EMAIL', N'Dear {contact}, invoice {no} of AED {amount} for {shop} was due on {date}. Kindly arrange payment. — DataCare Softech FZCO', 1),
  ('TICKET_OVERDUE', 0, 'EMAIL', N'Ticket {no} for {shop} is past its response time ({date}). — DcAMC', 1);
GO
