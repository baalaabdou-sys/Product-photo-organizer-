import { Classification } from "./classify";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

async function findOrCreateFolder(
  name: string,
  parentId: string,
  accessToken: string
): Promise<string> {
  const q = encodeURIComponent(
    `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const listRes = await fetch(`${DRIVE_API}?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listData = await listRes.json();
  if (listData.files?.length) return listData.files[0].id;

  const createRes = await fetch(DRIVE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const createData = await createRes.json();
  return createData.id;
}

// Resolves the nested folder path for a classification, creating folders as needed.
// e.g. Handbags -> Gucci, or Clothing -> Shirts -> Zara
export async function resolveTargetFolder(
  classification: Classification,
  rootFolderId: string,
  accessToken: string
): Promise<string> {
  let folderId = await findOrCreateFolder(
    classification.category,
    rootFolderId,
    accessToken
  );

  if (classification.category === "Clothing" && classification.subCategory) {
    folderId = await findOrCreateFolder(
      classification.subCategory,
      folderId,
      accessToken
    );
  }

  const brandFolderName = classification.brand ?? "Unbranded";
  folderId = await findOrCreateFolder(brandFolderName, folderId, accessToken);

  return folderId;
}

export async function uploadImage(
  base64Image: string,
  mimeType: string,
  fileName: string,
  folderId: string,
  accessToken: string
): Promise<void> {
  const metadata = { name: fileName, parents: [folderId] };
  const boundary = "photo_organizer_boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${base64Image}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  }
}
