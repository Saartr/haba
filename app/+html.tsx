import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// HTML-оболочка для веб-версии. Выполняется только при статическом рендере в
// Node, не в браузере, поэтому здесь нет ни состояния, ни провайдеров — они
// живут в корневом layout.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover — под вырезы на телефонах; user-scalable=no
            убирает случайный зум по двойному тапу, приложение и так мобильной ширины */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, user-scalable=no"
        />
        <title>Тапа — привычки и цели</title>
        <meta name="description" content="Приложение для привычек с групповыми целями." />
        <meta name="theme-color" content="#6047ff" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
