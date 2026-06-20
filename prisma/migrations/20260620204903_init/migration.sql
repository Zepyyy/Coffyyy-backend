-- CreateTable
CREATE TABLE "Bean" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "flavors" TEXT[],
    "rating" INTEGER NOT NULL,
    "roastLevel" INTEGER NOT NULL,
    "countries" TEXT[],
    "cities" TEXT[],
    "botanic" TEXT NOT NULL,
    "varieties" TEXT[],
    "brands" TEXT[],
    "status" TEXT NOT NULL DEFAULT '',
    "dominantNote" TEXT NOT NULL,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bean_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brew" (
    "id" SERIAL NOT NULL,
    "beanWeight" INTEGER,
    "espressoWeight" INTEGER,
    "extractionTime" TEXT,
    "flow" TEXT,
    "overallRating" INTEGER,
    "tasteScore" INTEGER,
    "strengthScore" INTEGER,
    "grindSize" INTEGER,
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
    "brand" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "model" TEXT NOT NULL,
    "grindRange" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
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
