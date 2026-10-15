-- Every DcAMC login has the same rights: everyone adds, changes and deletes everything.
UPDATE AMC_USER SET ROLE = 'OWNER', EDIT_DATE = SYSUTCDATETIME() WHERE ROLE <> 'OWNER';
GO
DECLARE @d SYSNAME = (SELECT dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id WHERE dc.parent_object_id = OBJECT_ID('AMC_USER') AND c.name = 'ROLE');
IF @d IS NOT NULL EXEC('ALTER TABLE AMC_USER DROP CONSTRAINT [' + @d + ']');
ALTER TABLE AMC_USER ADD CONSTRAINT DF_AMC_USER_ROLE DEFAULT 'OWNER' FOR ROLE;
GO
