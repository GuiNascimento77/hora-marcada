"""Teste opcional de ponta a ponta. Requer: pip install playwright e Google Chrome.
Usa somente dados fictícios; reserva criada é cancelada ao final e fica no histórico.
Execute com a aplicação iniciada: python tests/browser-smoke.py.
"""
import asyncio
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=os.getenv("CHROME_PATH", "/usr/bin/google-chrome"),
            headless=True, args=["--no-sandbox"],
        )
        page = await browser.new_page(viewport={"width": 1440, "height": 1000})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto(os.getenv("APP_URL", "http://localhost:4200").rstrip("/") + "/demo")
        await page.get_by_role("button", name="Novo agendamento").wait_for()
        await page.get_by_role("button", name="Novo agendamento").click()
        future = datetime.now(ZoneInfo("America/Sao_Paulo")) + timedelta(days=5)
        if future.weekday() == 6:
            future += timedelta(days=1)
        date = future.strftime("%Y-%m-%d")
        customer = "Cliente Teste " + datetime.now().strftime("%H%M%S")
        await page.get_by_label("Data do agendamento").fill(date)
        await page.locator(".time-options button").first.wait_for()
        first_time = await page.locator(".time-options button").first.inner_text()
        await page.locator(".time-options button").first.click()
        await page.get_by_role("button", name="Continuar", exact=True).click()
        await page.get_by_label("Nome do cliente", exact=True).fill(customer)
        await page.get_by_role("button", name="Confirmar agendamento", exact=True).click()
        await page.get_by_text("Agendamento confirmado.", exact=True).wait_for()
        await page.get_by_role("button", name="Voltar para a agenda").click()
        row = page.locator(".appointment-row").filter(has_text=customer)
        await row.wait_for()
        assert first_time in await row.inner_text()
        await page.reload()
        # O estado inicial usa a data padrão. Buscar a data reservada após recarregar.
        await page.get_by_label("Escolher data da agenda").fill(date)
        await row.wait_for()
        print("PASS: criar e persistir após recarregar")
        await page.get_by_role("button", name="Reagendar " + customer, exact=True).click()
        await page.locator(".time-options button").last.wait_for()
        new_time = await page.locator(".time-options button").last.inner_text()
        await page.locator(".time-options button").last.click()
        await page.get_by_role("button", name="Continuar", exact=True).click()
        await page.get_by_role("button", name="Confirmar alteração", exact=True).click()
        await page.get_by_text("Reagendamento confirmado.", exact=True).wait_for()
        await page.get_by_role("button", name="Voltar para a agenda").click()
        assert new_time in await row.inner_text()
        print("PASS: reagendar")
        await page.get_by_role("button", name="Cancelar " + customer, exact=True).click()
        await page.get_by_role("button", name="Cancelar reserva", exact=True).click()
        await page.get_by_role("dialog").wait_for(state="hidden")
        await row.wait_for(state="hidden")
        await page.get_by_label("Mostrar cancelados").check()
        await row.wait_for()
        assert "Cancelado" in await row.inner_text()
        print("PASS: cancelar e manter histórico")
        await page.get_by_role("button", name="Serviços", exact=True).click()
        assert await page.locator(".service-row").count() == 4
        await page.locator(".service-row").filter(has_text="Corte + barba").get_by_role("button", name="Agendar").click()
        assert await page.locator(".booking-fields select").input_value() == "combo"
        await page.keyboard.press("Escape")
        print("PASS: catálogo e agendamento com serviço pré-selecionado")
        await page.get_by_role("button", name="Equipe", exact=True).click()
        assert await page.locator(".team-card").count() == 3
        await page.locator(".team-card").first.get_by_role("button", name="Ver agenda").click()
        assert await page.get_by_label("Filtrar profissional").input_value() == "rafael"
        print("PASS: equipe e filtro")
        await page.get_by_label("Filtrar profissional").select_option("all")
        await page.get_by_label("Buscar cliente ou serviço").fill("nao-encontra-xyz")
        await page.get_by_text("Nenhum resultado por aqui.").wait_for()
        await page.get_by_role("button", name="Limpar filtros").click()
        print("PASS: busca e estado vazio")
        for width in [360, 390, 768, 1024, 1440]:
            await page.set_viewport_size({"width": width, "height": 844})
            dimensions = await page.evaluate("({viewport:innerWidth, content:document.documentElement.scrollWidth})")
            assert dimensions["content"] <= dimensions["viewport"], dimensions
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.get_by_role("button", name="Novo agendamento").click()
        await page.locator(".time-options button").first.wait_for()
        dimensions = await page.evaluate("({viewport:innerWidth, content:document.documentElement.scrollWidth})")
        assert dimensions["content"] <= dimensions["viewport"]
        await page.keyboard.press("Escape")
        assert not errors, errors
        print("PASS: responsividade 360/390/768/1024/1440px, modal e nenhum erro JavaScript")
        await browser.close()


asyncio.run(main())