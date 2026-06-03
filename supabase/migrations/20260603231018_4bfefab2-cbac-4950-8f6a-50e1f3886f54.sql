
REVOKE EXECUTE ON FUNCTION public.aplicar_baixa_contratos_pagos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_baixa_contratos_pagos() TO service_role;
