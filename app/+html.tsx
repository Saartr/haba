import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// HTML-оболочка для веб-версии. Выполняется только при статическом рендере в
// Node, не в браузере, поэтому здесь нет ни состояния, ни провайдеров — они
// живут в корневом layout.
// Ширина взята из макетов: они рисовались на кадре 393 px (iPhone 14/15),
// 480 — тот же телефонный формат с небольшим запасом.
// Фон вокруг рамки задан обеими темами, потому что системная тема на десктопе
// и в телефоне определяется одинаково — через prefers-color-scheme.
const frameStyles = `
  html, body { background: #e5e5e5; }
  #root {
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    background: #f5f5f5;
  }
  @media (min-width: 481px) {
    #root { box-shadow: 0 0 24px rgba(0, 0, 0, 0.08); }
  }
  @media (prefers-color-scheme: dark) {
    html, body { background: #000000; }
    #root { background: #121212; }
    @media (min-width: 481px) {
      #root { box-shadow: 0 0 24px rgba(0, 0, 0, 0.48); }
    }
  }
`;

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

        {/* Приложение нарисовано под телефон, поэтому на больших экранах не
            растягиваем его, а ограничиваем по ширине и центрируем. Всё здесь —
            только веб: этот файл в нативный бандл не попадает. */}
        <style dangerouslySetInnerHTML={{ __html: frameStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
