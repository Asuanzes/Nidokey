import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { NewsRow, newsTimeAgo } from "@/components/NewsSheet";
import { EmptyState, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAppStyle } from "@/lib/app-style-context";
import { fonts } from "@/lib/fonts";
import { useNews, type NewsItem } from "@/lib/hooks/useNews";
import { categoryColor } from "@/lib/records/config";
import { useTheme } from "@/lib/theme";

type TrendSource =
  | "twitter"
  | "reddit"
  | "linkedin"
  | "xiaohongshu"
  | "xueqiu"
  | "instagram"
  | "tiktok"
  | "youtube";

type TrendDTO = {
  id: string;
  name: string;
  source: TrendSource;
  query: string;
  locale: string;
  rank: number;
  volume: number | null;
  url: string | null;
  updatedAt: string;
};

export default function TrendDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const trendId = typeof id === "string" ? id : null;
  const { th, dark } = useTheme();
  const { appStyle } = useAppStyle();
  const { t, i18n } = useTranslation();
  const accent = categoryColor("trends", dark, appStyle);
  const [trend, setTrend] = useState<TrendDTO | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const newsQuery = useMemo(() => ({ kind: "trend" as const, trendId }), [trendId]);
  const { items: news, loading: newsLoading, error: newsError, reload: reloadNews } = useNews(newsQuery);
  const volumeFmt = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);

  const loadTrend = useCallback(async () => {
    if (!trendId) {
      setTrend(null);
      setTrendError(t("trends.load_error"));
      setTrendLoading(false);
      return;
    }
    setTrendLoading(true);
    setTrendError(null);
    try {
      setTrend(await api<TrendDTO>(`/api/trends/${encodeURIComponent(trendId)}`));
    } catch (e) {
      setTrendError(e instanceof Error ? e.message : t("trends.load_error"));
    } finally {
      setTrendLoading(false);
    }
  }, [trendId, t]);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadTrend(), reloadNews()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadTrend, reloadNews]);

  const header = (
    <View style={styles.header}>
      {trendLoading && !trend ? (
        <ActivityIndicator color={accent} style={styles.headerLoader} />
      ) : trendError && !trend ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t("trends.load_error")}
          description={trendError}
          actionLabel={t("common.retry")}
          onAction={() => void loadTrend()}
        />
      ) : trend ? (
        <View style={[styles.hero, { backgroundColor: th.surfaceRaised, borderColor: th.border }]}>
          <View style={styles.heroTop}>
            <View style={[styles.sourceChip, { backgroundColor: accent }]}>
              <Text style={styles.sourceChipText}>{trendSourceLabel(trend.source, t)}</Text>
            </View>
            <Text style={[styles.updated, { color: th.textSubtle }]}>{newsTimeAgo(trend.updatedAt, t)}</Text>
          </View>
          <Text style={[styles.name, { color: th.text }]}>{trend.name}</Text>
          <View style={styles.stats}>
            {trend.volume != null && (
              <Text style={[styles.stat, { color: th.textMuted }]}>
                {t("trends.volume_label")}: {volumeFmt.format(trend.volume)}
              </Text>
            )}
            <Text style={[styles.stat, { color: th.textMuted }]}>#{trend.rank}</Text>
          </View>
        </View>
      ) : null}
      <Text style={[styles.sectionTitle, { color: th.text }]}>{t("trends.related_news")}</Text>
    </View>
  );

  return (
    <Screen background backgroundCategory="trends">
      <FlatList<NewsItem>
        data={news}
        keyExtractor={(item) => item.url}
        contentContainerStyle={[styles.list, news.length === 0 && styles.emptyList]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={accent}
            colors={[accent]}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          newsLoading ? (
            <ActivityIndicator color={accent} style={styles.newsLoader} />
          ) : newsError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title={t("trends.load_error")}
              description={newsError}
              actionLabel={t("common.retry")}
              onAction={reloadNews}
            />
          ) : (
            <EmptyState icon="newspaper-outline" title={t("trends.empty")} />
          )
        }
        renderItem={({ item }) => <NewsRow item={item} />}
      />
    </Screen>
  );
}

function trendSourceLabel(source: TrendSource, t: ReturnType<typeof useTranslation>["t"]): string {
  if (source === "twitter") return t("trends.source_twitter");
  if (source === "reddit") return t("trends.source_reddit");
  if (source === "linkedin") return t("trends.source_linkedin");
  if (source === "xiaohongshu") return t("trends.source_xiaohongshu");
  if (source === "xueqiu") return t("trends.source_xueqiu");
  return source;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  header: { gap: 14, paddingTop: 8 },
  headerLoader: { marginVertical: 18 },
  hero: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sourceChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sourceChipText: { color: "#fff", fontSize: 10, fontFamily: fonts.bodyBold },
  updated: { fontSize: 11, fontFamily: fonts.bodyMedium },
  name: { fontSize: 24, lineHeight: 30, fontFamily: fonts.headingBold },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { fontSize: 12, fontFamily: fonts.bodySemibold },
  sectionTitle: { fontSize: 17, fontFamily: fonts.headingBold, marginTop: 2 },
  newsLoader: { marginTop: 20 },
});
