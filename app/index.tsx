import { useState } from "react";
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { classifyImage } from "../services/classify";
import { resolveTargetFolder, uploadImage } from "../services/drive";
import { useGoogleDriveAuth } from "../services/auth";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";
const DRIVE_ROOT_FOLDER_ID =
  process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "";

type LogEntry = { fileName: string; status: string };

export default function Index() {
  const { accessToken, promptAsync } = useGoogleDriveAuth(GOOGLE_CLIENT_ID);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  async function handleOrganize() {
    if (!accessToken) {
      await promptAsync();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    setBusy(true);
    setLog([]);

    for (const asset of result.assets) {
      const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
      try {
        if (!asset.base64) throw new Error("No image data");
        const mimeType = asset.mimeType ?? "image/jpeg";

        const classification = await classifyImage(
          asset.base64,
          mimeType,
          GEMINI_API_KEY
        );

        if (classification.category === "Unsorted") {
          setLog((l) => [...l, { fileName, status: "Skipped (not a product photo)" }]);
          continue;
        }

        const folderId = await resolveTargetFolder(
          classification,
          DRIVE_ROOT_FOLDER_ID,
          accessToken
        );

        await uploadImage(asset.base64, mimeType, fileName, folderId, accessToken);

        setLog((l) => [
          ...l,
          {
            fileName,
            status: `Filed under ${classification.category}${
              classification.subCategory ? "/" + classification.subCategory : ""
            }/${classification.brand ?? "Unbranded"}`,
          },
        ]);
      } catch (err: any) {
        setLog((l) => [...l, { fileName, status: `Error: ${err.message}` }]);
      }
    }

    setBusy(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Product Photo Organizer</Text>

      {!accessToken ? (
        <Button title="Sign in with Google" onPress={() => promptAsync()} />
      ) : (
        <Button
          title={busy ? "Organizing..." : "Organize Photos"}
          onPress={handleOrganize}
          disabled={busy}
        />
      )}

      {busy && <ActivityIndicator style={{ marginTop: 16 }} />}

      <ScrollView style={styles.log}>
        {log.map((entry, i) => (
          <Text key={i} style={styles.logLine}>
            {entry.fileName}: {entry.status}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 24 },
  log: { marginTop: 24 },
  logLine: { fontSize: 13, marginBottom: 8 },
});
