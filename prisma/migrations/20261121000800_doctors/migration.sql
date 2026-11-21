-- CreateTable
CREATE TABLE "DoctorProfile" (
    "userId" TEXT NOT NULL,
    "qualifications" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "consultationFee" DECIMAL(10,2) NOT NULL,
    "hours" JSONB,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

