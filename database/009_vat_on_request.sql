-- VAT is added only where it is ticked: per party (its installation, AMC and upgrade bills) and per AMC contract.
IF COL_LENGTH('AMC_CUSTOMER', 'VAT_ON') IS NULL ALTER TABLE AMC_CUSTOMER ADD VAT_ON BIT NOT NULL CONSTRAINT DF_AMC_CUSTOMER_VAT_ON DEFAULT 0;
GO
-- the columns' own defaults were 5 %: make them 0 so nothing ever gets VAT by accident
DECLARE @t SYSNAME, @d SYSNAME, @sql NVARCHAR(400);
DECLARE c CURSOR LOCAL FOR SELECT OBJECT_NAME(dc.parent_object_id), dc.name FROM sys.default_constraints dc JOIN sys.columns col ON col.object_id = dc.parent_object_id AND col.column_id = dc.parent_column_id WHERE col.name = 'VAT_PRC' AND OBJECT_NAME(dc.parent_object_id) IN ('AMC_CONTRACT', 'AMC_INVOICE');
OPEN c; FETCH NEXT FROM c INTO @t, @d;
WHILE @@FETCH_STATUS = 0 BEGIN SET @sql = N'ALTER TABLE ' + QUOTENAME(@t) + N' DROP CONSTRAINT ' + QUOTENAME(@d); EXEC (@sql); FETCH NEXT FROM c INTO @t, @d; END
CLOSE c; DEALLOCATE c;
GO
ALTER TABLE AMC_CONTRACT ADD CONSTRAINT DF_AMC_CONTRACT_VAT_PRC DEFAULT 0 FOR VAT_PRC;
GO
ALTER TABLE AMC_INVOICE ADD CONSTRAINT DF_AMC_INVOICE_VAT_PRC DEFAULT 0 FOR VAT_PRC;
GO
-- the setting is now only the rate used when VAT is ticked
DELETE FROM APP_SET WHERE SET_KEY = 'VAT_PRC';
GO
