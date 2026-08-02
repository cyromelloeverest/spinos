-- AlterTable
ALTER TABLE "icps" ADD COLUMN     "companiesToAvoid" TEXT[],
ADD COLUMN     "idealCustomerDescription" TEXT,
ADD COLUMN     "preferredSignalCategories" "SignalCategory"[];

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "role" TEXT;
