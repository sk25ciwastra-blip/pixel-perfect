const assert = require("node:assert/strict");
const { validateEmployeePrivateProfile, maskNik, validateFacePortraitFile, FACE_PHOTO_MAX_BYTES } =
  require("../src/lib/employee-private-profile.ts");
const valid = { nik: "0123456789012345", phone: "+628123456789", emergencyName: "Kontak Darurat",
  emergencyRelationship: "Keluarga", emergencyPhone: "081234567891" };
assert.deepEqual(validateEmployeePrivateProfile(valid), valid);
assert.match(maskNik(valid.nik), /2345$/);
assert.ok(!maskNik(valid.nik).includes(valid.nik));
for (const bad of ["", "123456789012345", "12345678901234567", "12345678901234a6", " 1234567890123456"]) {
  assert.throws(() => validateEmployeePrivateProfile({ ...valid, nik: bad }), /NIK/);
}
for (const field of ["phone", "emergencyPhone"]) {
  assert.throws(() => validateEmployeePrivateProfile({ ...valid, [field]: "abc" }), /telepon/);
}
assert.throws(() => validateEmployeePrivateProfile({ ...valid, emergencyName: "" }), /darurat/);
assert.throws(() => validateEmployeePrivateProfile({ ...valid, emergencyRelationship: "" }), /darurat/);
for (const type of ["image/jpeg","image/png","image/webp"]) {
  assert.doesNotThrow(() => validateFacePortraitFile({ type, size: FACE_PHOTO_MAX_BYTES }));
}
for (const type of ["application/pdf","image/svg+xml","image/heic","application/octet-stream"]) {
  assert.throws(() => validateFacePortraitFile({ type, size: 100 }), /Pas foto/);
}
for (const size of [0,FACE_PHOTO_MAX_BYTES+1,-1,NaN]) {
  assert.throws(() => validateFacePortraitFile({ type: "image/jpeg", size }), /Pas foto/);
}
console.log("PASS employee private profile validation: exact NIK, phone, emergency, masked NIK, portrait MIME/size and no document uploads");
