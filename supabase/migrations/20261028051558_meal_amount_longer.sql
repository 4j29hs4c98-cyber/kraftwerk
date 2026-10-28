alter table public.meal_plan_items drop constraint meal_plan_items_amount_check;
alter table public.meal_plan_items add constraint meal_plan_items_amount_check check (amount is null or char_length(amount) <= 500);
