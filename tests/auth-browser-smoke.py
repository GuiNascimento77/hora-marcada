"""Teste de contas fictícias. Cria duas contas; cancela reservas, não remove histórico.
Requer app iniciado, Playwright e Chrome. Não realiza login em contas Google reais.
"""
import asyncio
import os
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright


async def main():
    base = os.getenv("APP_URL", "http://localhost:4200").rstrip("/")
    suffix = uuid.uuid4().hex[:10]
    password = "Ficticia-" + uuid.uuid4().hex
    emails = [f"smoke-{suffix}-{i}@example.test" for i in range(2)]
    future = datetime.now(ZoneInfo("America/Sao_Paulo")) + timedelta(days=8)
    if future.weekday() == 6:
        future += timedelta(days=1)
    date = future.strftime("%Y-%m-%d")
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.getenv("CHROME_PATH", "/usr/bin/google-chrome"), headless=True, args=["--no-sandbox"])
        errors = []
        contexts = [await browser.new_context(viewport={"width": 1440, "height": 1000}) for _ in emails]
        pages = [await c.new_page() for c in contexts]
        for i, page in enumerate(pages):
            page.on("pageerror", lambda error: errors.append(str(error)))
            await page.goto(base + "/agenda")
            await page.wait_for_url("**/entrar")
            await page.get_by_role("button", name="Criar conta", exact=True).click()
            await page.get_by_label("Seu nome", exact=True).fill(["Cliente Fictício", "Gestor Fictício"][i])
            await page.get_by_label("E-mail", exact=True).fill(emails[i])
            await page.get_by_label("Senha", exact=True).fill(password)
            await page.get_by_role("button", name="Criar minha conta").click()
            await page.get_by_text("MINHA AGENDA PRIVADA", exact=True).wait_for()
        page, second = pages
        await page.get_by_role("button", name="Novo agendamento").click()
        await page.get_by_label("Data do agendamento").fill(date)
        await page.locator(".time-options button").first.wait_for()
        await page.locator(".time-options button").first.click()
        await page.get_by_role("button", name="Continuar", exact=True).click()
        customer = "Reserva Privada " + suffix
        await page.get_by_label("Nome do cliente", exact=True).fill(customer)
        await page.get_by_role("button", name="Confirmar agendamento", exact=True).click()
        await page.get_by_text("Agendamento confirmado.", exact=True).wait_for()
        await page.get_by_role("button", name="Voltar para a agenda").click()
        row = page.locator(".appointment-row").filter(has_text=customer)
        await row.wait_for()
        await page.reload()
        await page.get_by_label("Escolher data da agenda").fill(date)
        await row.wait_for()
        await second.get_by_label("Escolher data da agenda").fill(date)
        await second.get_by_text("Ainda não há reservas para esta data.", exact=True).wait_for()
        assert await second.locator(".appointment-row").filter(has_text=customer).count() == 0
        demo = await contexts[1].new_page()
        await demo.goto(base + "/demo")
        await demo.get_by_label("Escolher data da agenda").fill(date)
        assert await demo.locator(".appointment-row").filter(has_text=customer).count() == 0
        print("PASS: cadastro, sessão após reload e isolamento entre clientes/demo")
        # CLI só contra o banco configurado para esta mesma execução, nunca URL externa.
        if not os.getenv("APP_URL"):
            process = await asyncio.create_subprocess_exec("bun", "--env-file=../../.env", "tools/set-role.ts", emails[1], "admin", cwd=str(Path(__file__).resolve().parents[1] / "packages/web"), stdout=asyncio.subprocess.PIPE)
            await process.communicate()
            assert process.returncode == 0
            try:
                await second.reload()
                await second.get_by_text("ADMINISTRAÇÃO", exact=True).wait_for()
                await second.get_by_label("Escolher data da agenda").fill(date)
                await second.locator(".appointment-row").filter(has_text=customer).wait_for()
                print("PASS: administrador provisionado por CLI vê reserva privada de outra conta")
            finally:
                process = await asyncio.create_subprocess_exec("bun", "--env-file=../../.env", "tools/set-role.ts", emails[1], "customer", cwd=str(Path(__file__).resolve().parents[1] / "packages/web"), stdout=asyncio.subprocess.PIPE)
                await process.communicate()
                assert process.returncode == 0
        await page.get_by_role("button", name="Cancelar " + customer, exact=True).click()
        await page.get_by_role("button", name="Cancelar reserva", exact=True).click()
        await page.get_by_role("dialog").wait_for(state="hidden")
        await page.get_by_role("button", name="Sair da conta", exact=True).click()
        await page.wait_for_url("**/entrar")
        await page.get_by_label("E-mail", exact=True).fill(emails[0])
        await page.get_by_label("Senha", exact=True).fill("Senha-Errada-!")
        await page.get_by_role("button", name="Entrar na minha agenda").click()
        await page.get_by_text("E-mail ou senha incorretos.", exact=True).wait_for()
        await page.get_by_label("Senha", exact=True).fill(password)
        await page.get_by_role("button", name="Entrar na minha agenda").click()
        await page.get_by_text("MINHA AGENDA PRIVADA", exact=True).wait_for()
        await page.get_by_role("button", name="Sair da conta", exact=True).click()
        await page.wait_for_url("**/entrar")
        for width in [360, 390, 768, 1024, 1440]:
            await page.set_viewport_size({"width": width, "height": 1000})
            assert await page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        assert not errors, errors
        print("PASS: logout, senha incorreta, login e responsividade do acesso; sem erros JS")
        await browser.close()


asyncio.run(main())