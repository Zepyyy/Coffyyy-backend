-- CreateEnum
CREATE TYPE "Status" AS ENUM ('EXCELLENT', 'GOOD', 'MID', 'HORRIBLE', 'NEW');

-- CreateEnum
CREATE TYPE "DominantNote" AS ENUM ('FRUITY', 'NUTTY', 'FLORAL', 'SWEET', 'SOUR', 'SPICES', 'ROASTED', 'GREEN');

-- CreateEnum
CREATE TYPE "Botanic" AS ENUM ('ARABICA', 'ROBUSTA');

-- CreateEnum
CREATE TYPE "Designation" AS ENUM ('PURE_ORIGIN', 'BLEND');

-- CreateTable
CREATE TABLE "Bean" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "flavors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating" INTEGER NOT NULL DEFAULT 0,
    "roastLevel" INTEGER NOT NULL DEFAULT 0,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "botanic" "Botanic" NOT NULL DEFAULT 'ARABICA',
    "varieties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "Status" NOT NULL DEFAULT 'NEW',
    "dominantNote" "DominantNote" NOT NULL DEFAULT 'FRUITY',
    "designation" "Designation" NOT NULL DEFAULT 'PURE_ORIGIN',
    "finished" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bean_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brew" (
    "id" SERIAL NOT NULL,
    "beanWeight" INTEGER DEFAULT 0,
    "espressoWeight" INTEGER DEFAULT 0,
    "extractionTime" TEXT DEFAULT '',
    "flow" TEXT DEFAULT '',
    "overallRating" INTEGER DEFAULT 0,
    "tasteScore" INTEGER DEFAULT 0,
    "strengthScore" INTEGER DEFAULT 0,
    "grindSize" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "beanId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "purchaseDate" TIMESTAMP(3),
    "model" TEXT NOT NULL DEFAULT '',
    "grindRange" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bean_name_key" ON "Bean"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_name_key" ON "Machine"("name");

-- AddForeignKey
ALTER TABLE "Brew" ADD CONSTRAINT "Brew_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brew" ADD CONSTRAINT "Brew_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
