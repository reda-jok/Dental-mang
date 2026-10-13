-- Account 5200 ("العمولات") was never posted to. It becomes the expense category staff
-- use when they hand a dentist their pay. The profit and loss leaves it out and counts
-- each dentist's calculated pay instead, so it isn't counted twice.
UPDATE "ledger_account" SET "name" = 'أجور الأطباء' WHERE "code" = '5200';
