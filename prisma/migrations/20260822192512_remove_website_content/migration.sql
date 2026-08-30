/*
  Website copy and the services list moved into src/config/content.config.ts.

  Dropping `Service` discards its 6 rows deliberately — the same six services
  now live in that config file. `WebsiteContent` held the Home/About/Contact
  JSON blobs and has no replacement in the database.

  Contact email, phone and address are unaffected: they live in `SiteSetting`
  under the `general` key and stay editable in Admin → Settings.
*/

-- DropTable
DROP TABLE "Service";

-- DropTable
DROP TABLE "WebsiteContent";
