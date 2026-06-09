import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { ArticleWebViewScreen } from "@/components/ArticleWebViewScreen";
import type { Article } from "@/lib/article";

/**
 * Ruta de detalle de noticia. Recibe el `Article` serializado por params
 * (`router.push({ pathname:"/article", params:{ article: JSON.stringify(...) } })`)
 * y lo pinta con `ArticleWebViewScreen`. La cabecera nativa la pone `_layout`.
 */
export default function ArticleRoute() {
  const { th } = useTheme();
  const { t } = useTranslation();
  const { article: raw } = useLocalSearchParams<{ article?: string }>();

  let article: Article | null = null;
  try {
    if (typeof raw === "string") article = JSON.parse(raw) as Article;
  } catch {
    article = null;
  }

  if (!article?.url) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: th.bg }}>
        <Text style={{ color: th.dangerFg }}>{t("news.article_open_error")}</Text>
      </View>
    );
  }

  return <ArticleWebViewScreen article={article} />;
}
