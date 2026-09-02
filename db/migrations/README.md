Bu klasor, Asama 2'den itibaren Flicklet veritabani semasindaki degisiklikleri
SQL dosyasi olarak izler. Kural: bir migration once buraya dosya olarak
eklenir, once staging Supabase projesinde calistirilip dogrulanir, sadece
Recep'in onayindan sonra production'da uygulanir. Hicbir sema degisikligi
production'a manuel/kayitsiz sekilde yapilmaz.

Dosya adlandirma: `NNN_aciklama.up.sql` (uygula) + `NNN_aciklama.down.sql` (geri al) + `NNN_aciklama.verify.sql` (uygulandiktan sonra elle calistirilacak salt-okunur dogrulama sorgulari).
