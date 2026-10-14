import { useCallback, useState } from "react";
import { Text, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useApi } from "../../src/api";
import { Screen, Card, Button, Notice, s, colors } from "../../src/ui";
import type { Announcement } from "../../../../packages/protocol";
export default function Announcements() {
  const api = useApi();
  const [items, setItems] = useState<Announcement[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(
        (await api<{ announcements: Announcement[] }>("/announcements"))
          .announcements,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const markRead = async (id: string) => {
    try {
      await api(`/announcements/${id}/read`, "POST", {});
      setItems((current) =>
        current.map((a) => (a.id === id ? { ...a, read: true } : a)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Screen
      title="Announcements"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void refresh()}
          tintColor={colors.blue}
        />
      }
    >
      <Text style={s.body}>News and updates from New Tibet.</Text>
      <Notice error={error} />
      {items.map((item) => (
        <Card key={item.id}>
          <Text style={s.small}>
            {new Date(item.created_at).toLocaleDateString()} ·{" "}
            {item.read ? "Read" : "New"}
          </Text>
          <Text style={[s.h2, { marginTop: 14 }]}>{item.title}</Text>
          <Text style={[s.body, { color: colors.ink }]}>{item.body}</Text>
          {!item.read && (
            <Button
              secondary
              title="Mark as read"
              onPress={() => void markRead(item.id)}
            />
          )}
        </Card>
      ))}
      {!loading && !error && !items.length && (
        <Card>
          <Text style={s.h2}>You’re all caught up.</Text>
          <Text style={s.body}>Community announcements will appear here.</Text>
        </Card>
      )}
      <Text style={s.small}>
        Only New Tibet administrators can publish announcements. Pull down to
        refresh.
      </Text>
    </Screen>
  );
}
