CREATE TYPE "AccountType" AS ENUM ('individual', 'microteam', 'team', 'enterprise');

CREATE TYPE "TeamType" AS ENUM ('personal', 'commercial_team', 'department');

ALTER TABLE "Workspace"
ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'team';

ALTER TABLE "Team"
ADD COLUMN "teamType" "TeamType" NOT NULL DEFAULT 'commercial_team';
