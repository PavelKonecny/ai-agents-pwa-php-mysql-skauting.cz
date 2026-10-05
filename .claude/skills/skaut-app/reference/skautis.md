# Přihlášení přes skautIS (volitelné)

Výchozí přístup jsou **pozvánky** (fungují i pro děti bez účtu). skautIS je doplněk pro dospělé,
kteří účet mají: po propojení se mohou přihlásit na novém zařízení bez pozvánky.

> ⚠️ Modul `api/lib/skautis.php` je napsaný podle veřejně známého postupu skautISu, ale **nebyl
> ověřen proti skutečnému skautISu**. Před ostrým použitím ho vyzkoušej na testovacím skautISu
> a případné rozdíly (názvy polí, adresy služeb) oprav – a tento soubor aktualizuj.

## Princip

1. Aplikace přesměruje na `https://is.skaut.cz/Login/?appid=<APPID>` (test: `test-is.skaut.cz`).
2. Po přihlášení skautIS pošle **POST** na návratovou adresu registrovanou k APPID:
   `https://<aplikace>/api/skautis.php` (pole `skautIS_Token`, případně `skautIS_IDRole`, `skautIS_IDUnit`).
3. `api/skautis.php` ověří token webovou službou `UserManagement` → `UserDetail` (vrací `ID_Person`),
   uloží **jednorázový kód** (5 minut) a přesměruje do aplikace na `#/skautis?kod=…`.
4. Aplikace kód použije:
   - přihlášený uživatel (pozvánkou) → `skautis.propojit` → k jeho přístupu se uloží `skautisOsoba`,
   - nepřihlášený → `skautis.prihlasit` → najde přístup s touto osobou a vydá zařízení vlastní token.
5. Účet skautIS **nikdy nedává přístup sám o sobě** – bez předchozí pozvánky a propojení se nepřihlásí.

## Zprovoznění

1. Požádej o **ID aplikace (APPID)** u správců skautISu (nejdřív pro testovací prostředí).
   Uveď název aplikace a návratovou adresu `https://<aplikace>/api/skautis.php`.
2. Na hostingu ověř PHP rozšíření **soap** (`SoapClient`).
3. V `api/config.php`: `'skautis' => ['appid' => '<APPID>', 'test' => true]`.
4. Vyzkoušej: Profil → „Propojit se skautIS“ → přihlášení → návrat („Účet skautIS je propojený“) →
   v jiném prohlížeči úvodní obrazovka → „Přihlásit přes skautIS“.
5. Až funguje, požádej o produkční APPID a nastav `'test' => false`.

## Ověřit při zprovoznění

- [ ] Adresa WSDL `…/JunakWebservice/UserManagement.asmx?WSDL` a název metody `UserDetail`
      s parametrem `userDetailInput { ID_Login, ID_Application }`.
- [ ] Návratová hodnota obsahuje `ID_Person` (a jméno/`UserName`).
- [ ] skautIS opravdu posílá POST na registrovanou adresu (ne GET, ne jinam).
- [ ] Odhlášení ve skautISu nevadí – aplikace si drží vlastní token, který jde zrušit ve Správě.

## Co nedělat

- Neukládej skautIS token (`ID_Login`) – po ověření ho zahoď; aplikace používá jen vlastní tokeny.
- Nepřebírej ze skautISu víc údajů, než je potřeba (stačí `ID_Person` pro propojení).
- Role v aplikaci řídí správce aplikace, ne role ve skautISu (pokud to projekt výslovně nevyžaduje).
