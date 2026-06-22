-- DropForeignKey
ALTER TABLE "Brew" DROP CONSTRAINT "Brew_beanId_fkey";

-- DropForeignKey
ALTER TABLE "Brew" DROP CONSTRAINT "Brew_machineId_fkey";

-- AddForeignKey
ALTER TABLE "Brew" ADD CONSTRAINT "Brew_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brew" ADD CONSTRAINT "Brew_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
